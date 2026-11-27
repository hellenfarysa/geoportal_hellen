// 1. Definição dos Mapas de Fundo (Base Layers)
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
});

var satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
});

var relevo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Style: &copy; OpenTopoMap'
});

// 2. Inicialização do Mapa
var map = L.map('map', {
    center: [-7.15, -36.80],
    zoom: 8,
    layers: [osm]
});

// 3. Panes dedicados (z-index > 400) para que TODAS as camadas vetoriais
// fiquem sempre acima dos mapas de fundo (tilePane = 200) e permitam
// controle direto de transparência (CSS opacity) em todo o pane
var panesConfig = {
    paneMunicipios: 410,
    paneBacias: 420,
    paneDrenagem: 430,
    paneAcudes: 440,
    paneAdutoras: 450
};

Object.keys(panesConfig).forEach(function (paneName) {
    var pane = map.createPane(paneName);
    pane.style.zIndex = panesConfig[paneName];
    pane.style.opacity = '1';
});

// Garante que o mapa de fundo nunca sobreponha as camadas ao alternar
map.on('baselayerchange', function (e) {
    if (e.layer && e.layer.bringToBack) {
        e.layer.bringToBack();
    }
});

// Controle apenas para troca do Mapa de Fundo no canto superior direito
var baseMaps = {
    "OpenStreetMap": osm,
    "Satélite (Esri)": satelite,
    "Topográfico / Relevo": relevo
};
L.control.layers(baseMaps, null, { collapsed: false, position: 'topright' }).addTo(map);

// 4. Localizador inteligente de variáveis GeoJSON (suporta nomes padrão e exportações do QGIS2Web)
function obterDadosGeoJson(possiveisNomes, palavraChave) {
    for (var i = 0; i < possiveisNomes.length; i++) {
        var nome = possiveisNomes[i];
        if (typeof window[nome] !== 'undefined' && window[nome] && window[nome].type === 'FeatureCollection') {
            return window[nome];
        }
    }
    // Busca fallback por palavra-chave nas variáveis globais (ex: json_acudes_3, json_bacias_0)
    var chaves = Object.keys(window);
    for (var j = 0; j < chaves.length; j++) {
        var k = chaves[j];
        if (k.toLowerCase().indexOf(palavraChave) !== -1) {
            var val = window[k];
            if (val && typeof val === 'object' && val.type === 'FeatureCollection') {
                return val;
            }
        }
    }
    return null;
}

// 5. Configuração das 5 Camadas
var configCamadas = [
    {
        id: 'acudes',
        palavraChave: 'acude',
        variaveis: ['acudes', 'acudesh_3', 'acudes_pb', 'json_acudes_3', 'json_acudesh_3'],
        pane: 'paneAcudes',
        style: {
            color: '#045a8d',
            weight: 1.5,
            opacity: 1.0,
            fillColor: '#0570b0',
            fillOpacity: 0.75
        },
        popupFn: function (p) {
            return "<b>" + (p.Nome || p.NOME || "Açude") + "</b><br>" +
                   "Município: " + (p.Municipio || p.MUNICIPIO || "-") + "<br>" +
                   "Capacidade: " + (p.Capacidade ? Number(p.Capacidade).toLocaleString('pt-BR') + " m³" : "-") + "<br>" +
                   "Órgão Resp.: " + (p.Org_Resp || "-");
        }
    },
    {
        id: 'adutoras',
        palavraChave: 'adutora',
        variaveis: ['adutoras', 'sistemas_adutores', 'adutoras_pb', 'json_adutoras'],
        pane: 'paneAdutoras',
        style: {
            color: '#e31a1c',
            weight: 2.5,
            opacity: 1.0,
            fillOpacity: 0,
            dashArray: '6, 4'
        },
        popupFn: function (p) {
            return "<b>Sistema Adutor:</b> " + (p.Nome || p.NOME || "Adutora");
        }
    },
    {
        id: 'drenagem',
        palavraChave: 'drenag',
        variaveis: ['drenagem', 'rios', 'hidrografia', 'json_drenagem'],
        pane: 'paneDrenagem',
        style: {
            color: '#3690c0',
            weight: 1.5,
            opacity: 1.0,
            fillOpacity: 0
        },
        popupFn: function (p) {
            return "<b>Drenagem:</b> " + (p.Nome || p.NOME || p.rio || "Curso d'água");
        }
    },
    {
        id: 'bacias',
        palavraChave: 'bacia',
        variaveis: ['bacias_hidro', 'bacias', 'bacias_hidrograficas', 'json_bacias_hidro'],
        pane: 'paneBacias',
        style: {
            color: '#2b8cbe',
            weight: 2,
            opacity: 1.0,
            fillColor: '#7bccc4',
            fillOpacity: 0.35
        },
        popupFn: function (p) {
            return "<b>Bacia Hidrográfica:</b> " + (p.Nome || p.NOME || p.bacia || "Bacia");
        }
    },
    {
        id: 'municipios',
        palavraChave: 'municip',
        variaveis: ['limites_municipais', 'municipios', 'municipios_pb', 'json_limites_municipais'],
        pane: 'paneMunicipios',
        style: {
            color: '#555555',
            weight: 1.2,
            opacity: 1.0,
            fillColor: '#cccccc',
            fillOpacity: 0.15
        },
        popupFn: function (p) {
            return "<b>Município:</b> " + (p.Nome || p.NOME || p.municipio || "Município");
        }
    }
];

var controlesAtivos = [];

// 6. Vincula cada camada ao seu Checkbox (Ativação) e Slider (Transparência/Opacidade)
configCamadas.forEach(function (cfg) {
    var card = document.getElementById('card-' + cfg.id);
    var checkbox = document.getElementById('chk-' + cfg.id);
    var slider = document.getElementById('rng-' + cfg.id);
    var valueLabel = document.getElementById('val-' + cfg.id);
    var paneElement = map.getPane(cfg.pane);

    var layerGeoJson = null;

    try {
        var dados = obterDadosGeoJson(cfg.variaveis, cfg.palavraChave);
        if (dados) {
            layerGeoJson = L.geoJSON(dados, {
                pane: cfg.pane,
                style: function () {
                    return Object.assign({}, cfg.style);
                },
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        pane: cfg.pane,
                        radius: 6,
                        color: cfg.style.color,
                        weight: cfg.style.weight,
                        opacity: cfg.style.opacity,
                        fillColor: cfg.style.fillColor || cfg.style.color,
                        fillOpacity: cfg.style.fillOpacity || 0.7
                    });
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties && cfg.popupFn) {
                        layer.bindPopup(cfg.popupFn(feature.properties));
                    }
                }
            }).addTo(map);
        } else {
            console.warn("Dados GeoJSON não encontrados para a camada:", cfg.id);
        }
    } catch (erro) {
        console.error("Erro ao carregar camada " + cfg.id + ":", erro);
    }

    // Função que aplica a opacidade tanto no Pane CSS quanto nos estilos vetoriais
    function aplicarOpacidade(percentual) {
        var fator = percentual / 100;
        valueLabel.textContent = percentual + '%';

        // 1. Atualiza diretamente o CSS opacity do pane da camada (efeito imediato e garantido)
        if (paneElement) {
            paneElement.style.opacity = String(fator);
        }

        // 2. Atualiza também as propriedades SVG/Canvas da camada Leaflet
        if (layerGeoJson && typeof layerGeoJson.setStyle === 'function') {
            layerGeoJson.setStyle({
                opacity: cfg.style.opacity * fator,
                fillOpacity: cfg.style.fillOpacity * fator
            });
        }
    }

    // Evento de Ativação / Desativação da Camada
    checkbox.addEventListener('change', function () {
        if (this.checked) {
            card.classList.add('active');
            slider.disabled = false;
            if (layerGeoJson) {
                map.addLayer(layerGeoJson);
                aplicarOpacidade(parseInt(slider.value, 10));
            }
        } else {
            card.classList.remove('active');
            slider.disabled = true;
            if (layerGeoJson) {
                map.removeLayer(layerGeoJson);
            }
        }
        atualizarTextoBotaoGeral();
    });

    // Evento de Ajuste de Transparência / Opacidade (em tempo real ao arrastar ou soltar)
    slider.addEventListener('input', function () {
        aplicarOpacidade(parseInt(this.value, 10));
    });
    slider.addEventListener('change', function () {
        aplicarOpacidade(parseInt(this.value, 10));
    });

    controlesAtivos.push(checkbox);
});

// 7. Botão Geral: Desmarcar Todas / Marcar Todas
var btnToggleAll = document.getElementById('btn-toggle-all');

function atualizarTextoBotaoGeral() {
    var algumaMarcada = controlesAtivos.some(function (chk) { return chk.checked; });
    btnToggleAll.textContent = algumaMarcada ? 'Desmarcar Todas' : 'Marcar Todas';
}

btnToggleAll.addEventListener('click', function () {
    var algumaMarcada = controlesAtivos.some(function (chk) { return chk.checked; });
    var novoEstado = !algumaMarcada;

    controlesAtivos.forEach(function (chk) {
        if (chk.checked !== novoEstado) {
            chk.checked = novoEstado;
            chk.dispatchEvent(new Event('change'));
        }
    });
});