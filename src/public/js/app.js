/* =============================================================================
   Cafetería Origen — lógica del sitio público
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var CARRITO_KEY = 'origen.carrito';

  var estado = {
    tipo: '',
    variedad: '',
    q: '',
    carrito: cargarCarrito(),
  };

  /* ---------------------------------------------------------------- utils */
  function $(sel) { return document.querySelector(sel); }

  function money(valor) {
    var n = Number(valor || 0);
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function crearElemento(etiqueta, clase, texto) {
    var elemento = document.createElement(etiqueta);

    if (clase) elemento.className = clase;
    if (texto != null) elemento.textContent = String(texto);

    return elemento;
  }

  function raw(valor) {
    // FALLA: esta función NO escapa nada, devuelve el valor tal cual.
    // La forma correcta de renderizar texto del servidor es escaparHtml()
    // (o textContent en vez de innerHTML).
    return String(valor == null ? '' : valor);
  }

  function api(url, opciones) {
    return fetch(API + url, opciones).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function postJSON(url, cuerpo) {
    return api(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function guardarCarrito() {
    try {
      localStorage.setItem(CARRITO_KEY, JSON.stringify(estado.carrito));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function cargarCarrito() {
    try {
      return JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function escaparHtml(texto) {
    var div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  /* ------------------------------------------------------------- catálogo */
  function urlCatalogo() {
    var params = new URLSearchParams();
    if (estado.tipo) params.set('tipo', estado.tipo);
    if (estado.variedad) params.set('variedad', estado.variedad);
    if (estado.q) params.set('q', estado.q);
    var s = params.toString();
    return '/productos' + (s ? '?' + s : '');
  }

  function cargarProductos() {
    return api(urlCatalogo()).then(function (resp) {
      if (!resp.ok) {
        renderErrorProductos(resp.data && resp.data.error);
        return;
      }
      renderProductos(resp.data.productos);
      renderResultado(resp.data.filtros, resp.data.total);
    });
  }

  function renderProductos(productos) {
    var grid = $('#productos-grid');
    grid.replaceChildren();

    if (!productos || productos.length === 0) {
      var vacio = document.createElement('p');
      vacio.className = 'empty';
      vacio.textContent = 'No encontramos productos con esos filtros.';
      grid.appendChild(vacio);
      return;
    }

    productos.forEach(function (p) {
      window.__productos[p.id] = p;

      var tarjeta = document.createElement('article');
      tarjeta.className = 'product-card';

      var superior = document.createElement('div');
      superior.className = 'product-top';

      var nombre = document.createElement('h3');
      nombre.className = 'product-name';
      nombre.textContent = p.nombre;

      var precio = document.createElement('span');
      precio.className = 'product-price';
      precio.textContent = money(p.precio);

      superior.appendChild(nombre);
      superior.appendChild(precio);
      tarjeta.appendChild(superior);

      var etiquetas = document.createElement('div');
      etiquetas.className = 'product-tags';

      function agregarEtiqueta(valor, clase) {
        var etiqueta = document.createElement('span');
        etiqueta.className = clase;
        etiqueta.textContent = valor;
        etiquetas.appendChild(etiqueta);
      }

      agregarEtiqueta(p.tipo, 'tag');

      if (p.variedad) {
        agregarEtiqueta(p.variedad, 'tag tag-origen');
      }

      if (p.tamano) {
        agregarEtiqueta(p.tamano, 'tag');
      }

      tarjeta.appendChild(etiquetas);

      var descripcion = document.createElement('p');
      descripcion.className = 'product-desc';
      descripcion.textContent = p.descripcion;
      tarjeta.appendChild(descripcion);

      var boton = document.createElement('button');
      boton.className = 'btn btn-ghost btn-agregar';
      boton.textContent = 'Agregar';
      boton.setAttribute('data-id', String(p.id));

      tarjeta.appendChild(boton);
      grid.appendChild(tarjeta);
    });
  }

  function renderResultado(filtros, total) {
    var el = $('#resultado-busqueda');
    el.replaceChildren();

    if (filtros && filtros.q) {
      el.appendChild(document.createTextNode('Resultados para '));

      var busqueda = document.createElement('strong');
      busqueda.textContent = filtros.q;
      el.appendChild(busqueda);

      el.appendChild(
        document.createTextNode(' — ' + total + ' producto(s)')
      );
    } else {
      el.textContent = total + ' producto(s) en el menú';
    }
  }

  function renderErrorProductos(mensaje) {
    var grid = $('#productos-grid');
    grid.replaceChildren();

    var error = document.createElement('p');
    error.className = 'empty';
    error.textContent =
      'No se pudo cargar el menú: ' + (mensaje || 'error desconocido');

    grid.appendChild(error);
  }

  /* --------------------------------------------------------------- carrito */
  function agregarAlCarrito(productoId) {
    var existente = null;
    for (var i = 0; i < estado.carrito.length; i++) {
      if (String(estado.carrito[i].id) === String(productoId)) existente = estado.carrito[i];
    }
    if (existente) {
      existente.cantidad += 1;
    } else {
      estado.carrito.push({
        id: productoId,
        nombre: window.__productos[productoId] ? window.__productos[productoId].nombre : 'Producto',
        precio: window.__productos[productoId] ? window.__productos[productoId].precio : 0,
        cantidad: 1,
      });
    }
    guardarCarrito();
    renderCarrito();
  }

  function cambiarCantidad(indice, delta) {
    var item = estado.carrito[indice];
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function quitarDelCarrito(indice) {
    estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function renderCarrito() {
    var cont = $('#carrito');
    var lista = $('#resumen-carrito');
    var total = 0;

    cont.replaceChildren();
    lista.replaceChildren();

    if (estado.carrito.length === 0) {
      cont.appendChild(crearElemento('p', 'empty', 'El carrito está vacío.'));
      $('#resumen-total').textContent = money(0);
      return;
    }

    // FALLA 7: crear elementos seguros sin usar innerHTML.
    estado.carrito.forEach(function (item, i) {
      var subtotal = item.precio * item.cantidad;
      total += subtotal;

      var fila = crearElemento('div', 'cart-item');
      var info = crearElemento('div');

      info.appendChild(crearElemento('div', 'cart-item-name', item.nombre));
      info.appendChild(crearElemento('div', 'cart-item-meta', money(item.precio) + ' c/u'));
      fila.appendChild(info);

      var controles = crearElemento('div', 'qty-control');

      function boton(texto, accion) {
        var b = crearElemento('button', '', texto);
        b.type = 'button';
        b.dataset.acc = accion;
        b.dataset.i = String(i);
        return b;
      }

      controles.appendChild(boton('−', 'menos'));
      controles.appendChild(crearElemento('span', '', item.cantidad));
      controles.appendChild(boton('+', 'mas'));
      fila.appendChild(controles);

      var acciones = crearElemento('div');
      acciones.appendChild(crearElemento('div', 'cart-item-price', money(subtotal)));

      var quitar = boton('Quitar', 'quitar');
      quitar.className = 'link-danger';
      acciones.appendChild(quitar);

      fila.appendChild(acciones);
      cont.appendChild(fila);

      var li = crearElemento('li');
      li.appendChild(crearElemento('span', '', item.nombre + ' × ' + item.cantidad));
      li.appendChild(crearElemento('span', '', money(subtotal)));
      lista.appendChild(li);
    });

    $('#resumen-total').textContent = money(total);
  }

  /* ---------------------------------------------------------------- pedidos */
  function enviarPedido(evento) {
    evento.preventDefault();
    var feedback = $('#pedido-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Enviando…';

    postJSON('/pedidos', {
      mesa: $('#pedido-mesa').value,
      cliente: $('#pedido-cliente').value,
      items: estado.carrito.map(function (item) {
        return { productoId: item.id, cantidad: item.cantidad };
      }),
    }).then(function (resp) {
      if (!resp.ok) {
        // FALLA (XSS reflejado): el mensaje del servidor se pinta con innerHTML.
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No pudimos enviar el pedido: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Pedido #' + resp.data.id + ' recibido! Total ' + money(resp.data.total) +
        '. Te atendemos en la mesa ' + resp.data.mesa + '.';
      estado.carrito = [];
      guardarCarrito();
      renderCarrito();
      $('#form-pedido').reset();
    }).catch(function () {
      feedback.className = 'form-feedback is-error';
      feedback.textContent = 'Error de conexión con el servidor.';
    });
  }

  /* --------------------------------------------------------------- reseñas */
  function cargarReseñas() {
    return api('/comentarios').then(function (resp) {
      var cont = $('#lista-resenas');
      cont.replaceChildren();

      if (!resp.ok || !resp.data.comentarios ||
          resp.data.comentarios.length === 0) {
        cont.appendChild(
          crearElemento('p', 'empty', 'Todavía no hay reseñas. ¡Sé el primero!')
        );
        return;
      }

      resp.data.comentarios.forEach(function (c) {
        var articulo = crearElemento('article', 'review');
        var encabezado = crearElemento('div', 'review-head');

        var autor = crearElemento('span', 'review-author', c.autor);
        var estrellas = crearElemento(
          'span',
          'review-stars',
          '★'.repeat(Math.max(0, Math.min(5, Number(c.calificacion) || 0)))
        );

        encabezado.appendChild(autor);
        encabezado.appendChild(estrellas);

        articulo.appendChild(encabezado);
        articulo.appendChild(crearElemento('p', 'review-text', c.texto));

        cont.appendChild(articulo);
      });
    });
  }

  function enviarReseña(evento) {
    evento.preventDefault();
    var feedback = $('#resena-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Publicando…';

    postJSON('/comentarios', {
      autor: $('#resena-autor').value,
      texto: $('#resena-texto').value,
      calificacion: Number($('#resena-calificacion').value),
    }).then(function (resp) {
      if (!resp.ok) {
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No se pudo publicar: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Gracias por tu reseña!';
      $('#form-resena').reset();
      cargarReseñas();
    });
  }

  /* ------------------------------------------------------------- listeners */
  function init() {
    window.__productos = {};

    // Filtros
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        estado.tipo = chip.getAttribute('data-tipo');
        cargarProductos();
      });
    });

    $('#filtro-variedad').addEventListener('change', function (e) {
      estado.variedad = e.target.value;
      cargarProductos();
    });

    var temporizador = null;
    $('#filtro-busqueda').addEventListener('input', function (e) {
      estado.q = e.target.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(cargarProductos, 250);
    });

    // Carrito (delegación de eventos)
    $('#productos-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-agregar');
      if (!btn) return;
      agregarAlCarrito(btn.getAttribute('data-id'));
    });

    $('#carrito').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var i = Number(btn.getAttribute('data-i'));
      var accion = btn.getAttribute('data-acc');
      if (accion === 'mas') cambiarCantidad(i, 1);
      else if (accion === 'menos') cambiarCantidad(i, -1);
      else if (accion === 'quitar') quitarDelCarrito(i);
    });

    $('#form-pedido').addEventListener('submit', enviarPedido);
    $('#form-resena').addEventListener('submit', enviarReseña);

    // Carga inicial
    api(urlCatalogo()).then(function (resp) {
      if (resp.ok) {
        (resp.data.productos || []).forEach(function (p) { window.__productos[p.id] = p; });
        renderProductos(resp.data.productos);
        renderResultado(resp.data.filtros, resp.data.total);
      } else {
        renderErrorProductos(resp.data.error);
      }
    });
    cargarReseñas();
    renderCarrito();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
