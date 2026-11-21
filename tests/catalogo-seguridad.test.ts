import { test } from 'node:test';
import assert from 'node:assert/strict';

import { listar, obtener } from '../src/services/catalogo.service';

test('RED - el filtro tipo no permite inyeccion SQL', async () => {
  const tipoMalicioso = "cafe' OR '1'='1";

  const productos = await listar({ tipo: tipoMalicioso });

  assert.equal(
    productos.length,
    0,
    'El filtro tipo devolvio productos que no coinciden con el valor solicitado'
  );
});

test('RED - obtener no permite inyeccion SQL en el ID', async () => {
  const idMalicioso = "1' OR '1'='1";

  const producto = await obtener(idMalicioso);

  assert.equal(
    producto,
    null,
    'Se obtuvo un producto utilizando un ID con inyeccion SQL'
  );
});