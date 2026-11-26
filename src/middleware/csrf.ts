import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { obtenerSesion } from './sesion';

// Este middleware lo implemento acá para que quede mas limpo el arreglo
// en routes para la Vul08 CSRF.

const METODOS_MUTADORES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function compararToken(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function origenValido(req: Request): boolean {
  const host = req.get('host');
  if (!host) return true;

  const origin = req.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return true;
}

export function proteccionCsrf(req: Request, res: Response, next: NextFunction) {
  if (!METODOS_MUTADORES.has(req.method.toUpperCase())) {
    return next();
  }

  if (!origenValido(req)) {
    return res.status(403).json({ error: 'Origen no permitido (CSRF).' });
  }

  const sesion = obtenerSesion(req);
  if (sesion) {
    const tokenCabecera = req.get('x-csrf-token');
    const tokenCuerpo =
      req.body && typeof req.body._csrf === 'string' ? req.body._csrf : undefined;
    const tokenRecibido = tokenCabecera || tokenCuerpo;

    if (!tokenRecibido || !compararToken(tokenRecibido, sesion.csrfToken)) {
      return res.status(403).json({ error: 'Token anti-CSRF inválido o faltante.' });
    }
  }

  return next();
}