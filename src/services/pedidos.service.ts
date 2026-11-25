import * as db from '../db';
import { calcularPrecio } from '../catalogo';
import type {
  Pedido,
  PedidoConItems,
  PedidoItem,
  Producto,
  ErrorHttp,
} from '../tipos';
/** Un renglón del pedido, tal como llega en el cuerpo de la petición. */
export interface ItemPedido {
  productoId: number;
  cantidad: number;
}

/** Pedido nuevo, tal como llega en el cuerpo de la petición. */
export interface NuevoPedido {
  mesa: string;
  cliente: string;
  items: ItemPedido[];
}

/** Id tal como llega en la URL (texto) o ya convertido. */
type Id = number | string;

/**
 * Servicio de pedidos.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Validación de entrada débil o insuficiente (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 * No se valida nada de lo que llega en el cuerpo de la petición:
 *  - `cantidad` puede ser negativa (el total del pedido queda negativo),
 *    cero, un número decimal o un texto.
 *  - No hay un máximo de items ni de cantidad (DoS / facturas absurdas).
 *  - `mesa` y `cliente` no se validan ni se acotan en longitud.
 *  - Si el productoId no existe, la excepción sube y se filtra el stack.
 *
 * La corrección es validar TIPO (entero), RANGO (1..N), LONGITUD y FORMATO
 * de cada campo en el servidor, usando listas blancas.
 * -----------------------------------------------------------------------------
 */

/**
 * Crea un pedido a partir de una lista de items { productoId, cantidad }.
 * Total = suma de calcularPrecio(producto) x cantidad
 */
export async function crear({
  mesa,
  cliente,
  items,
}: NuevoPedido): Promise<PedidoConItems | null> {

  // Genera un error HTTP 400 para las entradas inválidas.
  const errorValidacion = (mensaje: string): ErrorHttp => {
    const error = new Error(mensaje) as ErrorHttp;
    error.status = 400;
    return error;
  };

  // Validar los datos generales del pedido.
  if (
    typeof mesa !== 'string' ||
    mesa.trim().length === 0 ||
    mesa.length > 20
  ) {
    throw errorValidacion('La mesa no es válida.');
  }

  if (
    typeof cliente !== 'string' ||
    cliente.trim().length === 0 ||
    cliente.length > 100
  ) {
    throw errorValidacion('El nombre del cliente no es válido.');
  }

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 20
  ) {
    throw errorValidacion(
      'El pedido debe tener entre 1 y 20 productos.'
    );
  }

  // Validar todos los items antes de consultar o modificar la base.
  for (const item of items) {
    if (
      !item ||
      !Number.isSafeInteger(item.productoId) ||
      item.productoId <= 0
    ) {
      throw errorValidacion(
        'El identificador del producto no es válido.'
      );
    }

    if (
      !Number.isSafeInteger(item.cantidad) ||
      item.cantidad < 1 ||
      item.cantidad > 100
    ) {
      throw errorValidacion(
        'La cantidad debe ser un entero entre 1 y 100.'
      );
    }
  }

  const filas: {
    productoId: number;
    cantidad: number;
    precioUnitario: number;
  }[] = [];

  for (const item of items) {
    const producto = await buscarProducto(item.productoId);

    if (!producto) {
      throw errorValidacion(
        'El producto solicitado no existe.'
      );
    }

    const precioUnitario = calcularPrecio(producto);

    filas.push({
      productoId: producto.id,
      cantidad: item.cantidad,
      precioUnitario,
    });
  }

  const total = filas.reduce(
    (acc, f) => acc + f.precioUnitario * f.cantidad,
    0
  );

  const { rows } = await db.query<Pedido>(
    `INSERT INTO pedidos (mesa, cliente, estado, total)
     VALUES ($1, $2, 'abierto', $3)
     RETURNING *`,
    [mesa, cliente, total]
  );

  const pedido = rows[0];

  for (const fila of filas) {
    await db.query(
      `INSERT INTO pedido_items
       (pedido_id, producto_id, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)`,
      [
        pedido.id,
        fila.productoId,
        fila.cantidad,
        fila.precioUnitario,
      ]
    );
  }

  return obtenerConItems(pedido.id);
}



/** Busca un producto por id (helper interno). */
async function buscarProducto(
  productoId: number
): Promise<Producto | null> {
  const { rows } = await db.query<Producto>(
    'SELECT * FROM productos WHERE id = $1',
    [productoId]
  );

  return rows[0] || null;
}

/** Lista pedidos (con filtro opcional por mesa). */
export async function listar(mesa?: string): Promise<Pedido[]> {
  // FALLA: inyección SQL en el filtro de mesa.
  let sql = 'SELECT * FROM pedidos';
  if (mesa) sql += ` WHERE mesa = '${mesa}'`;
  sql += ' ORDER BY id DESC';

  const { rows } = await db.query<Pedido>(sql);
  return rows;
}

/** Devuelve un pedido con sus items. */
export async function obtenerConItems(id: Id): Promise<PedidoConItems | null> {
  const { rows: pedidos } = await db.query<Pedido>(
    'SELECT * FROM pedidos WHERE id = $1',
    [id]
  );
  const pedido = pedidos[0];
  if (!pedido) return null;

  const { rows: items } = await db.query<PedidoItem>(
    `SELECT pi.*, pr.nombre AS producto_nombre
       FROM pedido_items pi
       JOIN productos pr ON pr.id = pi.producto_id
      WHERE pi.pedido_id = $1`,
    [id]
  );

  return { ...pedido, items };
}

/** Cambia el estado de un pedido. */
export async function cambiarEstado(id: Id, estado: string): Promise<Pedido | null> {
  const { rows } = await db.query<Pedido>(
    'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
    [estado, id]
  );
  return rows[0] || null;
}
