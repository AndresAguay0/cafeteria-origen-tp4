import express from 'express';
import rateLimit from 'express-rate-limit';
import * as usuarios from '../services/usuarios.service';
import { crearSesion, destruirSesion, obtenerSesion } from '../middleware/sesion';
import { proteccionCsrf } from '../middleware/csrf';

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intentá nuevamente en 15 minutos.',
  },
});

/**
 * Inicio de sesión.
 *
 * FALLAS:
 *  - Inyección SQL en la verificación de credenciales (ver usuarios.service).
 *  - Contraseñas almacenadas en texto plano.
 *  - Mensajes de error que distinguen "usuario inexistente" de "contraseña
 *    incorrecta" → enumeración de usuarios.
 *  - Sin rate limiting ni bloqueo: fuerza bruta ilimitada.
 *  - El identificador de sesión no se regenera (fijación de sesión).
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Falta usuario o contraseña.' });
    }

    // La verificación de credenciales es la consulta concatenada (SQLi).
    const usuario = await usuarios.autenticar(username, password);

    if (!usuario) {
  return res.status(401).json({
    error: 'Usuario o contraseña incorrectos.',
  });
}

    crearSesion(req, res, {
      id: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      nombre: usuario.nombre,
    });

    res.json({
      mensaje: `¡Bienvenido, ${usuario.nombre}!`,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        nombre: usuario.nombre,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Cierre de sesión.
 *
 * FALLA: sólo borra la cookie del navegador. La sesión sigue existiendo en el
 * servidor, así que con la cookie robada se puede seguir usando.
 */
router.post('/logout', proteccionCsrf, (req, res) => {
  destruirSesion(req);
  res.clearCookie('sid', { path: '/' });
  res.json({ mensaje: 'Sesión cerrada.' });
});

/** Devuelve el usuario de la sesión actual. */
router.get('/yo', (req, res) => {
  const sesion = obtenerSesion(req);
  if (!sesion) {
    return res.status(401).json({ error: 'Necesitás iniciar sesión.' });
  }
  res.json({ usuario: sesion.usuario });
});

// Ruta para leer el Token csrf de la sesion activa
router.get('/csrf-token', (req, res) => {
  const sesion = obtenerSesion(req);
  if (!sesion) {
    return res.status(401).json({ error: 'No hay sesión activa.' });
  }
  return res.json({
    csrfToken: sesion.csrfToken,
    token: sesion.csrfToken,
  });
});

export default router;
