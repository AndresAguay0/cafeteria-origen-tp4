import * as db from '../db';
import type { Comentario } from '../tipos';

/** Datos de una reseña nueva, tal como llegan en el cuerpo de la petición. */
export interface NuevoComentario {
  autor: string;
  texto: string;
  calificacion: number;
}

/**
 * Servicio de comentarios / reseñas de la cafetería.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Validación de entrada débil (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 * No se valida longitud, ni formato, ni que la calificación esté en rango.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Cross-Site Scripting almacenado (OWASP A03:2021)
 * -----------------------------------------------------------------------------
 * El texto del comentario se guarda tal cual y luego se devuelve en las
 * respuestas JSON que la web inserta en el DOM. Como el cliente lo pinta con
 * innerHTML, el script queda almacenado en la base y se ejecuta en el
 * navegador de CADA visitante (incluidos los administradores).
 *
 * Corrección: escapar/sanear la salida en el cliente (textContent en vez de
 * innerHTML) o, mejor, sanitizar en el servidor y aplicar CSP como capa extra.
 */

/** Lista todos los comentarios, del más nuevo al más viejo. */
export async function listar(): Promise<Comentario[]> {
  const { rows } = await db.query<Comentario>(
    'SELECT * FROM comentarios ORDER BY id DESC'
  );
  return rows;
}

/** Crea un comentario. */
export async function crear({ autor, texto, calificacion }: NuevoComentario): Promise<Comentario> {
  // FALLA: sin validación de longitud ni de rango de calificación.
  if (
    typeof autor !== 'string' ||
    autor.trim().length < 2 ||
    autor.trim().length > 40
  ) {
    const error = new Error('El nombre debe tener entre 2 y 40 caracteres.') as Error & { status: number };
    error.status = 400;
    throw error;
  }

  if (
    typeof texto !== 'string' ||
    texto.trim().length < 3 ||
    texto.trim().length > 1000
  ) {
    const error = new Error('La reseña debe tener entre 3 y 1000 caracteres.') as Error & { status: number };
    error.status = 400;
    throw error;
  }

  if (
    !Number.isInteger(calificacion) ||
    calificacion < 1 ||
    calificacion > 5
  ) {
    const error = new Error('La calificación debe ser un entero entre 1 y 5.') as Error & { status: number };
    error.status = 400;
    throw error;
  }

  const { rows } = await db.query<Comentario>(
    `INSERT INTO comentarios (autor, texto, calificacion)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [autor.trim(), texto.trim(), calificacion]
  );
  return rows[0];
}

/** Elimina un comentario. */
export async function eliminar(id: number | string): Promise<Comentario | null> {
  const { rows } = await db.query<Comentario>(
    'DELETE FROM comentarios WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}
