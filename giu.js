/**
 * @file gui.js
 * @desc Funciones para el parseador de recursos online de git-init-uja
 * @author Víctor Rivas <vrivas@ujaen.es>
 * @date 03-Feb-2024
 */

// Constantes
const ULTIMOS_RECURSOS = 5;
const MAX_URL_LENGTH = 50;
const FILTROS = ["tags", "temas", "formatos", "nivel", "idiomas"];

/**
 * Método de Array que devuelve todos los recursos que contienen alguno de los términos en el campo indicado
 * @param {Cadena} Campo
 * @param {Termino o Vector de Terminos} Terminos
 * @returns Vector con los recursos que contienen alguno de los términos en el campo indicado
 */
Array.prototype.selectPorCampo = function (campo, terminos) {
  let result = null;
  if (!campo) result = [];
  if (typeof terminos === "string") terminos = [terminos];
  if (!result) {
    result = this.filter(function (resource) {
      return terminos.reduce(function (accum, termino) {
        return (
          accum ||
          (typeof resource[campo] != "undefined" &&
            (resource[campo].includes(termino) || !termino))
        );
      }, false);
    });
  }
  return result;
};

/**
 * Método de Array que devuelve todos los recursos que contienen la cadena en el título
 * @param {Cadena} Busqueda
 * @returns Vector con los recursos que contiene la cadena de busqueda en el título
 */
Array.prototype.selectPorCadenaEnTitulo = function (busqueda) {
  let result = null;
  if (!busqueda) result = [];
  if (!result) {
    result = this.filter(function (resource) {
      let tituloNormalizado = resource.titulo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      let busquedaNormalizada = busqueda
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return tituloNormalizado.includes(busquedaNormalizada);
    });
  }
  return result;
};

/**
 * Crea un vector de strings con un índice de los valores de un campo
 * @param {String} campo
 * @returns Devuelve un índice de los valores de un campo
 */
Array.prototype.creaIndice = function (campo) {
  let result = [];
  if (campo) {
    this.forEach(function (resource) {
      if (typeof resource[campo] != "undefined") {
        resource[campo].forEach(function (termino) {
          if (!result.includes(termino)) result.push(termino);
        });
      }
    });
  }
  return result.sort();
};

/**
 * Crea un vector de objetos con dos campos: un valor para un campo y el número de recursos que lo contienen
 * @param {String} campo
 * @returns Devuelve un índice de los valores de un campo más el número de recursos que lo contienen
 */
Array.prototype.creaIndiceConCardinalidad = function (campo) {
  // thisArray es necesario para usarlo luego al establecer la cardinalidad
  let thisArray = this;
  let terminos = [];
  if (campo) {
    this.forEach(function (resource) {
      if (typeof resource[campo] != "undefined") {
        resource[campo].forEach(function (termino) {
          if (!terminos.includes(termino)) terminos.push(termino);
        });
      }
    });
  }
  terminos.sort();
  let result = terminos.map(function (termino) {
    return {
      valor: termino,
      cardinalidad: thisArray.selectPorCampo(campo, termino).length,
    };
  });
  return result;
};

/**
 * Muestra todos los elementos de un índice como checboxes
 * @param {String} divId Div en el que se van a mostrar los checkboxes
 * @param {Vector de pares} valores Conjunto de pares {termino,cardinalidad} que se van a mostrar
 * @param {Vector de string} cbMarcados Indica los cb que el usuario ha marcado en el filtro
 */
function escribeCheckbox(divId, valores, cbMarcados = []) {
  let div = document.getElementById(divId);
  let html = "";
  valores.forEach(function (par) {
    let valor = par.valor;
    let cardinalidad = par.cardinalidad;
    let checked = cbMarcados.includes(divId + "_" + valor) ? "checked" : "";
    html += `<input type="checkbox" name="cb" value="${divId}_${valor}" id="${divId}_${valor}" ${checked}>
        <label for="${divId}_${valor}">${valor} <span class='cardinalidad'>(${cardinalidad})</span></label><br>`;
  });
  div.innerHTML = html;
}
/**
 * Asigna eventos a los checkboxes para filtrar los recursos
 */
function asignaEventosCheckbox() {
  let cb = document.querySelectorAll("input[type=checkbox]");
  cb.forEach(function (checkbox) {
    checkbox.addEventListener("change", aplicarFiltros);
  });
}

/**
 * Muestra mensaje de error indicando que no se han encontrado recursos con el filtro seleccionado
 */
function mostrarMensajeNoSeEncontraronRecursos() {
  let div = document.getElementById("recursos");
  let html = `
        <div class="mensaje-error">
            <h3>No se encontraron recursos.</h3>
            <p>No ha marcado filtros de búsqueda o no se encontraron recursos para los filtros marcados.</p>
        </div>
    `;
  div.innerHTML = html;
}

/**
 * Compara dos recursos por nivel
 * @param {Recurso} a
 * @param {Recurso} b
 * @return Devuelve -1 si a es menor que b, 0 si son iguales y 1 si a es mayor que b,
 *         siendo básico < medio < avanzado
 */
function comparaPorNivel(a, b) {
  if (a.nivel.join() == b.nivel.join()) return 0;
  if (a.nivel == "básico") return -1;
  if (a.nivel == "medio" && b.nivel == "avanzado") return -1;
  return 1;
}

/**
 * Compara dos recursos por nivel, y alfabéticamente
 * @param {Recurso} a
 * @param {Recurso} b
 * @return Devuelve -1 para a<b; 0 para a==b y 1 para a>b.
 *          Primero tiene en cuenta el nivel y luego el orden alfabético del título.
 *          Para el nivel: siendo básico < medio < avanzado
 */
function comparaPorNivelYTitulo(a, b) {
  let porNivel = comparaPorNivel(a, b);
  if (porNivel != 0) return porNivel;
  const CHAR_QUITAR = ["¿", "¡"];
  let a_titulo = CHAR_QUITAR.includes(a.titulo[0])
    ? a.titulo.substr(1, a.titulo.length)
    : a.titulo;
  let b_titulo = CHAR_QUITAR.includes(b.titulo[0])
    ? b.titulo.substr(1, b.titulo.length)
    : b.titulo;
  return a_titulo < b_titulo ? -1 : a_titulo == b_titulo ? 0 : 1;
}
/**
 * Muestra los recursos, cada uno en un div
 * @param {Objeto que contiene un título y un vector de recursos} objetoRecursos
 */
function mostrarRecursos(objetoRecursos) {
  let titulo = document.getElementById("titulo-main");
  titulo.innerHTML =
    objetoRecursos.titulo + ` (${objetoRecursos.recursos.length})`;
  let div = document.getElementById("recursos");
  let html = "";
  objetoRecursos.recursos.forEach(function (resource, i) {
    html += recurso2html(resource);
  });
  div.innerHTML = html;
}

/**
 *
 */
function resaltarCadenaBuscada(cadena) {
  const cadenaBuscada = document.getElementById("buscar-recurso").value;
  if (cadenaBuscada.length > 0) {
    const cadenaNormalizada = cadena
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    let busquedaNormalizada = cadenaBuscada
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    let nuevaCadena = "";
    let ultimaPosicion = -1;
    let nuevaPosicion;
    while (
      (nuevaPosicion = cadenaNormalizada.indexOf(
        busquedaNormalizada,
        ultimaPosicion + 1,
      )) >= 0
    ) {
      nuevaCadena += cadena.substring(ultimaPosicion + 1, nuevaPosicion);
      nuevaCadena +=
        "<span class='termino-buscado'>" +
        cadena.substring(
          nuevaPosicion,
          nuevaPosicion + busquedaNormalizada.length,
        ) +
        "</span>";
      ultimaPosicion = nuevaPosicion;
    }
    // el resto del título
    nuevaCadena += cadena.substring(
      ultimaPosicion + busquedaNormalizada.length,
      cadena.length,
    );
    cadena = nuevaCadena;
  }
  return cadena;
}
/**
 * Convierte un recurso en un article con formato HTML
 * @param {Objeto} resource Recurso a convertir en HTML
 * @returns Recurso convertido en HTML
 */
function recurso2html(resource) {
  let num = "#" + resource.temas[0] + resource.numero;
  let tituloResaltado = resaltarCadenaBuscada(resource.titulo);
  return `
            <article class="recurso recurso-nivel-${resource.nivel}">
                <div class="contenedor-recurso-num"><p class="recurso-num">${num}</p></div>
                <div class="recurso-nivel">${resource.nivel}</div>
                <h3 class="recurso-titulo"><a href="${resource.url}" target="_blank">${tituloResaltado}</a></h3>
                <div class="listados-chips">
                    <div class="listado-chips-temas">
                        <div class="listado-chips-label">Temas</div>
                        ${resource.temas.map((e) => "<span class='chip-temas'>" + e + "</span> ").join("")}
                    </div>
                    <div class="listado-chips-tags">
                        <div class="listado-chips-label">Tags</div>
                        ${resource.tags.map((e) => "<span class='chip-tag'>" + e + "</span> ").join("")}
                    </div>
                    <div class="listado-chips-formatos">
                    <div class="listado-chips-label">Formatos</div>
                        ${resource.formatos.map((e) => "<span class='chip-formato'>" + e + "</span> ").join("")}
                    </div>
                    
                </div>
                <div class="recurso-url">${resource.url.split("/")[2]}</div>
            </article>
        `;
}
/**
 * Elimina los criterios de búsqueda duplicados para que no haya valores repetidos
 * en los vectores de tags, asignaturas y formatos.
 */
function eliminaCriteriosBusquedaDuplicados() {
  RESOURCES.forEach(function (resource) {
    FILTROS.forEach(function (filtro) {
      if (resource[filtro])
        resource[filtro] = resource[filtro]
          .sort()
          .filter((e, i, v) => v[i] != v[i + 1]);
    });
  });
}

/**
 * Obtiene los parámetros de location.search y los convierte en un objeto
 * @returns Objeto con los parámetros de location.search
 */
function getFiltrosPorParametro() {
  let filtros = {};
  let busqueda = "";
  let url = new URL(window.location.href);
  let searchParams = new URLSearchParams(url.search);
  searchParams.forEach((value, key) => {
    if (key != "q") {
      filtros[key] = value.split(",").map((e) => e.trim());
    } else {
      busqueda = value;
    }
  });
  //console.log("Filtros", filtros);
  return { filtros, busqueda };
}

/**
 * Aplica los filtros leidos en la llamada a la URL a los correspondientes checkboxes
 * @param {Objeto} filtros
 * @param {Cadena} busqueda
 * @returns Objeto con los recursos filtrados por los checkbox y por la cadena de búsqueda
 */
function aplicarFiltros(filtros, busqueda) {
  let cb = document.querySelectorAll("input[type=checkbox]");
  cb.forEach((checkbox) => {
    let [campo, valor] = checkbox.value.split("_");
    if (filtros[campo] && filtros[campo].includes(valor)) {
      checkbox.checked = true;
    }
  });
  if (busqueda) document.getElementById("buscar-recurso").value = busqueda;

  let tmpSelec = Array.from(cb)
    .filter((checkbox) => {
      return checkbox.checked;
    })
    .map((checkbox) => {
      return checkbox.value;
    });
  let result = tmpSelec.length
    ? {
        titulo: "Recursos encontrados",
        recursos: RESOURCES.filter((e) => true),
      }
    : ultimosNRecursos();

  let campos = [];
  tmpSelec.forEach((selec) => {
    let [campo, valor] = selec.split("_");
    result.recursos = result.recursos.selectPorCampo(campo, valor);
    campos.push(campo);
  });

  // Cribamos por la cadena de búsqueda
  busqueda = busqueda || document.getElementById("buscar-recurso").value;
  if (busqueda) {
    result.recursos = result.recursos.selectPorCadenaEnTitulo(busqueda);
  }

  // En este punto, ya están seleccionados los recursos que cumplen con los filtros y el criteri de búsqueda.
  // Intentamos "rehacer" los índices
  FILTROS.forEach(function (filtro) {
    escribeCheckbox(
      filtro,
      result.recursos.creaIndiceConCardinalidad(filtro),
      tmpSelec,
    );
  });
  asignaEventosCheckbox();

  // ordenamos y mostramos
  result.recursos.sort(comparaPorNivelYTitulo);
  mostrarRecursos(result);
  mostrarURLGeneradaPorFiltros(
    decodeURIComponent(setFiltrosEnURL(setFiltrosPorCheckboxYBusqueda())),
  );
  document.getElementById("buscar-recurso").focus();
}

/**
 * Crea un objeto con los filtros seleccionados en los checkboxes
 * @returns Vector con los filtros seleccionados
 */
function setFiltrosPorCheckboxYBusqueda() {
  let cb = document.querySelectorAll("input[type=checkbox]");
  let filtros = {};
  cb.forEach((checkbox) => {
    let [campo, valor] = checkbox.value.split("_");
    if (checkbox.checked) {
      if (filtros[campo]) {
        filtros[campo].push(valor);
      } else {
        filtros[campo] = [valor];
      }
    }
  });
  let busqueda = document.getElementById("buscar-recurso").value;
  if (busqueda)
    filtros["q"] = [document.getElementById("buscar-recurso").value];
  return filtros;
}

/**
 * Crea una URL con los filtros de búsqueda
 * @param {Objeto con los filtros de búsqueda} filtros
 * @returns
 */
function setFiltrosEnURL(filtros) {
  let url = new URL(window.location.href);
  let searchParams = new URLSearchParams("");
  for (let key in filtros) {
    searchParams.set(key, filtros[key].join(","));
  }
  url.search = searchParams.toString();
  //window.history.pushState({}, '', url);
  //console.log("URL", url);
  return url;
}

/**
 * Busca recursos por contenido en el título
 */
function buscarPorContenidoTituloRecurso(ev) {
  let texto = document.getElementById("buscar-recurso").value;
  aplicarFiltros(setFiltrosPorCheckboxYBusqueda(), texto);
  ev.preventDefault();
}

/**
 * Escribe la URL generada a partir de los filtros de los recursos
 * @param {URL generada a partir de los filtros de los recursos} url
 */
function mostrarURLGeneradaPorFiltros(url) {
  let div = document.getElementById("url-generada");
  div.innerHTML = `<a href="${url}">${url}</a>`;
}

/**
 * Copia la URL generada al portapapeles
 */
function copiarURLGenerada() {
  let url = document.getElementById("url-generada").querySelector("a").href;
  navigator.clipboard.writeText(url);
  alert("URL copiada al portapapeles");
}

function numeraRecursos() {
  RESOURCES.forEach((e, i) => (e.numero = i + 1));
}
/**
 * Función principal
 */
function main() {
  numeraRecursos(RESOURCES);
  eliminaCriteriosBusquedaDuplicados();
  FILTROS.forEach(function (filtro) {
    escribeCheckbox(filtro, RESOURCES.creaIndiceConCardinalidad(filtro));
  });

  let { filtros, busqueda } = getFiltrosPorParametro();
  aplicarFiltros(filtros, busqueda);

  // ASignación de eventos
  asignaEventosCheckbox();
  //document.getElementById("buscar-recurso-form").addEventListener("submit", buscarPorContenidoTituloRecurso)
  document
    .getElementById("buscar-recurso")
    .addEventListener("keyup", buscarPorContenidoTituloRecurso);
  document
    .getElementById("copiar-url-generada-btn")
    .addEventListener("click", copiarURLGenerada);

  document.getElementById("buscar-recurso").focus();
}

/**
 * Función que devuelve los últimos recursos del vector si no hay filtros
 * @param {Number} n Número de recursos que se quieren obtener. Por defecto 5
 * @returns Los últimos N recursos del vector
 */
function ultimosNRecursos(n = RESOURCES.length) {
  return {
    titulo:
      n < RESOURCES.length
        ? "Mostrando los últimos recursos añadidos"
        : "Mostrando todos los recursos",
    recursos: RESOURCES.slice(-n),
  };
}
