import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { obtenerSesion, sesiones } from '../src/middleware/sesion';

test('una sesión vencida se rechaza y elimina', () => {
  const id = 'prueba-expiracion';

  sesiones.set(id, {
    usuario: {
      id: 1,
      username: 'prueba',
      nombre: 'Prueba',
      rol: 'admin',
    },
    creadaEn: Date.now() - 60 * 60 * 1000,
    expiraEn: Date.now() - 1000,
    csrfToken: 'test-token'
  });

  const req = {
    headers: { cookie: `sid=${id}` },
  } as Request;

  assert.equal(obtenerSesion(req), null);
  assert.equal(sesiones.has(id), false);
});

import request from 'supertest';
import app from '../src/app';

test('una sesión vencida no puede acceder al diagnóstico', async () => {
  const id = 'prueba-diagnostico-expirado';

  sesiones.set(id, {
    usuario: {
      id: 1,
      username: 'admin',
      nombre: 'Administrador',
      rol: 'admin',
    },
    creadaEn: Date.now() - 60 * 60 * 1000,
    expiraEn: Date.now() - 1000,
    csrfToken: 'test-token'
  });

  const res = await request(app)
    .get('/api/_diagnostico')
    .set('Cookie', `sid=${id}`);

  assert.equal(res.status, 401);
  assert.equal(sesiones.has(id), false);
});