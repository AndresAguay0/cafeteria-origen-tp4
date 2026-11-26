import express from 'express';
import * as comentarios from '../services/comentarios.service';
import { proteccionCsrf } from '../middleware/csrf';

const router = express.Router();

router.use(proteccionCsrf);

/**
 * GET /api/comentarios — reseñas públicas de la cafetería.
 * El sitio las pinta con innerHTML: por eso son un vector de XSS almacenado.
 */
router.get('/', async (req, res, next) => {
  try {
    res.json({ comentarios: await comentarios.listar() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/comentarios
 *
 * FALLAS: sin token anti-CSRF, sin validación de longitud/rango y sin
 * sanitización (XSS almacenado).
 */
router.post('/', async (req, res, next) => {
  try {
    const { autor, texto, calificacion } = req.body || {};
    const comentario = await comentarios.crear({
      autor,
      texto,
      calificacion,
    });
    res.status(201).json(comentario);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/comentarios/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'El ID debe ser un entero positivo.',
      });
    }

    // FALLA: sin verificación de rol — cualquiera puede borrar reseñas.
    const comentario = await comentarios.eliminar(id);
    if (!comentario) {
      return res.status(404).json({ error: 'Comentario no encontrado.' });
    }
    res.json(comentario);
  } catch (err) {
    next(err);
  }
});

export default router;