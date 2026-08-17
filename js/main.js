let indicesAtuais = {};

function mudarFoto(produtoIdx, direcao, listaFotos) {
  if (indicesAtuais[produtoIdx] === undefined) indicesAtuais[produtoIdx] = 0;

  indicesAtuais[produtoIdx] += direcao;

  if (indicesAtuais[produtoIdx] >= listaFotos.length)
    indicesAtuais[produtoIdx] = 0;
  if (indicesAtuais[produtoIdx] < 0)
    indicesAtuais[produtoIdx] = listaFotos.length - 1;

  const imagemElemento = document.getElementById(`img-${produtoIdx}`);
  if (imagemElemento) {
    imagemElemento.src = listaFotos[indicesAtuais[produtoIdx]];
  }
}

async function carregarProdutos() {
  try {
    const container = document.getElementById("container-produtos");
    if (!container) return;
    const setor = container.dataset.setor;
    const categoria = container.dataset.categoria;

    const timestamp = Date.now();
    let produtos = [];

    try {
      const resposta = await fetch(`/api/products/${setor}/${categoria}?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (resposta.ok) {
        produtos = await resposta.json();
      } else {
        console.warn("API retornou status não-OK:", resposta.status);
      }
    } catch (e) {
      console.error("Erro ao buscar produtos da API:", e);
    }

    container.innerHTML = "";

    if (!Array.isArray(produtos) || produtos.length === 0) {
      const fallbackUrl = (setor === "semijoias" || setor === "lingeries")
        ? `/pages/${setor}/index.html`
        : "/index.html";
      container.innerHTML = `
        <div class="div-sem-produtos" style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: #666;">
          <p style="font-size: 1.15rem; margin-bottom: 20px; font-weight: 500;">Nenhum produto disponível no momento nesta categoria.</p>
          <a href="${fallbackUrl}" class="btn-voltar-catalogo" style="display: inline-block; padding: 10px 24px; background: #5c1838; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem;">Ver outras categorias</a>
        </div>
      `;
      return;
    }

    const urlBaseImagens = "../../../";

    // Helper function to build a structured variations index for a product
    function buildProductVariationsMap(prod) {
      const sizeToColors = {};
      const colorToSizes = {};
      const allSizesSet = new Set();
      const allColorsSet = new Set();
      const photoByCombination = {};
      const photoByColor = {};
      const photoBySize = {};

      function parseItemsList(val) {
        if (!val) return [];
        if (Array.isArray(val)) {
          return val.map(item => String(item || "").trim()).filter(item => item.length > 0);
        }
        if (typeof val === "string") {
          return val.split(",").map(item => item.trim()).filter(item => item.length > 0);
        }
        const strVal = String(val).trim();
        return strVal.length > 0 ? [strVal] : [];
      }

      let hasExplicitVariacoes = false;
      let hasAvailableVariations = false;
      const hasVariacoesArray = Array.isArray(prod.variacoes) && prod.variacoes.length > 0;

      if (hasVariacoesArray) {
        hasExplicitVariacoes = true;
        prod.variacoes.forEach((v) => {
          if (!v || typeof v !== "object") return;
          const isVarAvailable = (!v.vendido) && (v.quantidade === undefined || v.quantidade === null || Number(v.quantidade) > 0);
          
          const tams = parseItemsList(v.tamanhos || v.tamanho);
          const crs = parseItemsList(v.cores || v.cor);
          const vFoto = v.foto && String(v.foto).trim() !== "" ? String(v.foto).trim() : null;

          // Register photos
          if (vFoto) {
            if (tams.length > 0 && crs.length > 0) {
              tams.forEach(t => {
                crs.forEach(c => {
                  photoByCombination[`${t}___${c}`] = vFoto;
                });
              });
            }
            crs.forEach(c => {
              if (!photoByColor[c]) photoByColor[c] = vFoto;
            });
            tams.forEach(t => {
              if (!photoBySize[t]) photoBySize[t] = vFoto;
            });
          }

          // Only expose AVAILABLE variations in customer-facing dropdowns
          if (isVarAvailable) {
            hasAvailableVariations = true;
            tams.forEach(t => allSizesSet.add(t));
            crs.forEach(c => allColorsSet.add(c));

            if (tams.length > 0 && crs.length > 0) {
              tams.forEach(t => {
                if (!sizeToColors[t]) sizeToColors[t] = [];
                crs.forEach(c => {
                  if (!sizeToColors[t].includes(c)) sizeToColors[t].push(c);
                  if (!colorToSizes[c]) colorToSizes[c] = [];
                  if (!colorToSizes[c].includes(t)) colorToSizes[c].push(t);
                });
              });
            } else if (tams.length > 0) {
              tams.forEach(t => {
                if (!sizeToColors[t]) sizeToColors[t] = [];
              });
            } else if (crs.length > 0) {
              crs.forEach(c => {
                if (!colorToSizes[c]) colorToSizes[c] = [];
              });
            }
          }
        });
      }

      // Check legacy or direct tamanhos and cores if no explicit variations array
      if (!hasExplicitVariacoes) {
        const directSizes = parseItemsList(prod.tamanhos || prod.tamanho);
        const directColors = parseItemsList(prod.cores || prod.cor);

        directSizes.forEach(t => allSizesSet.add(t));
        directColors.forEach(c => allColorsSet.add(c));

        if (directSizes.length > 0 && directColors.length > 0) {
          directSizes.forEach(t => {
            sizeToColors[t] = [...directColors];
          });
          directColors.forEach(c => {
            colorToSizes[c] = [...directSizes];
          });
        }
      }

      const allSizes = Array.from(allSizesSet).filter(s => s && s.trim().length > 0);
      const allColors = Array.from(allColorsSet).filter(c => c && c.trim().length > 0);

      const isProductSold = prod.status === "vendido" || (hasVariacoesArray && !hasAvailableVariations);

      return {
        hasSizes: allSizes.length > 0,
        hasColors: allColors.length > 0,
        hasOptions: allSizes.length > 0 || allColors.length > 0,
        sizes: allSizes,
        colors: allColors,
        sizeToColors,
        colorToSizes,
        photoByCombination,
        photoByColor,
        photoBySize,
        isSold: isProductSold
      };
    }

    produtos.forEach((produto, index) => {
      const temMultiplasFotos =
        Array.isArray(produto.url) && produto.url.length > 1;

      let firstPhoto = temMultiplasFotos ? produto.url[0] : produto.url;
      if (!firstPhoto || firstPhoto.trim() === "") {
        firstPhoto = "/assets/img/placeholder.svg";
      }

      // Check variations mapping
      const varMap = buildProductVariationsMap(produto);
      const initialSize = varMap.sizes[0] || "";
      const initialColorsForSize = initialSize && varMap.sizeToColors[initialSize] && varMap.sizeToColors[initialSize].length > 0
        ? varMap.sizeToColors[initialSize]
        : varMap.colors;

      // Price html
      let precoHtml = `<p class="preco">R$ ${Number(produto.valor || 0).toFixed(2)}</p>`;
      if (produto.emPromocao && produto.precoPromocional && Number(produto.precoPromocional) > 0) {
        precoHtml = `
          <div class="preco-container">
            <span class="preco-de">R$ ${Number(produto.valor || 0).toFixed(2)}</span>
            <span class="preco-por">R$ ${Number(produto.precoPromocional).toFixed(2)}</span>
          </div>
        `;
      }

      const card = `
                <div class="produto-card" id="produto-${index}">
                    ${produto.emPromocao ? '<div class="faixa-promocao">PROMOÇÃO</div>' : ''}
                    ${varMap.isSold ? '<div class="tarja-vendido">VENDIDO</div>' : ""}
                    
                    <div class="slider-container">
                        ${
                          temMultiplasFotos
                            ? `
                            <button class="seta-slider prev" onclick="mudarFoto(${index}, -1, ${JSON.stringify(produto.url).replace(/"/g, "&quot;")})">&#10094;</button>
                        `
                            : ""
                        }
                        
                        <img src="${firstPhoto}" 
                             class="img-principal" 
                             id="img-${index}" 
                             data-original-src="${firstPhoto}"
                             alt="${produto.descricao || 'Produto'}" 
                             onerror="this.src='/assets/img/placeholder.svg'" />
                        
                        ${
                          temMultiplasFotos
                            ? `
                            <button class="seta-slider next" onclick="mudarFoto(${index}, 1, ${JSON.stringify(produto.url).replace(/"/g, "&quot;")})">&#10095;</button>
                        `
                            : ""
                        }
                    </div>

                    <h3>${produto.descricao || 'Produto'}</h3>
                    ${precoHtml}

                    ${
                      !varMap.isSold && varMap.hasOptions
                        ? `
                        <div class="produto-opcoes" data-card-idx="${index}">
                          ${
                            varMap.hasSizes
                              ? `
                              <div class="opcao-group">
                                <label for="tam-${index}">Tamanho:</label>
                                <select class="select-opcao select-tamanho" id="tam-${index}" data-card-idx="${index}">
                                  ${varMap.sizes.map((t, idx) => `<option value="${t}" ${idx === 0 ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                              </div>
                            `
                              : ""
                          }
                          ${
                            varMap.hasColors
                              ? `
                              <div class="opcao-group">
                                <label for="cor-${index}">Cor:</label>
                                <select class="select-opcao select-cor" id="cor-${index}" data-card-idx="${index}">
                                  ${initialColorsForSize.map((c, idx) => `<option value="${c}" ${idx === 0 ? 'selected' : ''}>${c}</option>`).join('')}
                                </select>
                              </div>
                            `
                              : ""
                          }
                        </div>
                      `
                        : ""
                    }

                    <p>${(produto.informacoes || '').replace(/\n/g, "<br>")}</p>

                    <div class="card-btn-container">
                      ${varMap.isSold ? `
                        <button type="button" class="btn-card-cart btn-card-vendido" disabled>
                          <span>Indisponível</span>
                        </button>
                      ` : `
                        <button type="button" class="btn-card-cart btn-add-to-cart" data-card-idx="${index}">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                          </svg>
                          <span>Adicionar ao Carrinho</span>
                        </button>
                      `}
                    </div>
                </div>
            `;
      container.innerHTML += card;
    });

    // Helper to get matching variation photo
    function getVariationPhoto(prod, varMap, tam, cor) {
      if (!varMap) return null;
      if (tam && cor && varMap.photoByCombination[`${tam}___${cor}`]) {
        return varMap.photoByCombination[`${tam}___${cor}`];
      }
      if (cor && varMap.photoByColor[cor]) {
        return varMap.photoByColor[cor];
      }
      if (tam && varMap.photoBySize[tam]) {
        return varMap.photoBySize[tam];
      }
      return null;
    }

    // Setup Add to Cart click listeners
    container.querySelectorAll(".btn-add-to-cart").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cardIdx = parseInt(btn.dataset.cardIdx);
        const prod = produtos[cardIdx];
        if (!prod) return;

        const cardEl = document.getElementById(`produto-${cardIdx}`);
        const tamSelect = cardEl ? cardEl.querySelector(".select-tamanho") : null;
        const corSelect = cardEl ? cardEl.querySelector(".select-cor") : null;

        const selectedTam = tamSelect ? tamSelect.value : "";
        const selectedCor = corSelect ? corSelect.value : "";

        const activePrice = (prod.emPromocao && prod.precoPromocional && Number(prod.precoPromocional) > 0)
          ? Number(prod.precoPromocional)
          : Number(prod.valor || 0);

        const varMap = buildProductVariationsMap(prod);
        const specificPhoto = getVariationPhoto(prod, varMap, selectedTam, selectedCor);
        const defaultImg = Array.isArray(prod.url) ? prod.url[0] : (prod.url || "/assets/img/placeholder.svg");
        const finalImg = specificPhoto || defaultImg;

        const performAddToCart = () => {
          if (window.VirtualCart) {
            window.VirtualCart.addItem({
              id: prod.id || `${setor}_${categoria}_${cardIdx}`,
              descricao: prod.descricao || "Produto",
              valor: activePrice,
              imagem: finalImg,
              tamanho: selectedTam,
              cor: selectedCor,
              setor: setor,
              categoria: categoria,
              quantidade: 1
            });
          }
        };

        if (window.VirtualCart) {
          performAddToCart();
        } else {
          setTimeout(performAddToCart, 150);
        }

        // Visual feedback on button
        const originalHtml = btn.innerHTML;
        btn.classList.add("added");
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Adicionado!</span>
        `;
        setTimeout(() => {
          btn.classList.remove("added");
          btn.innerHTML = originalHtml;
        }, 1500);
      });
    });

    // Setup interactive bidirectional link between Size and Color selects + photo switching
    container.querySelectorAll(".produto-opcoes").forEach((opcoesContainer) => {
      const cardIdx = parseInt(opcoesContainer.dataset.cardIdx);
      const prod = produtos[cardIdx];
      if (!prod) return;

      const varMap = buildProductVariationsMap(prod);
      const tamSelect = opcoesContainer.querySelector(".select-tamanho");
      const corSelect = opcoesContainer.querySelector(".select-cor");
      const imgElem = document.getElementById(`img-${cardIdx}`);

      // Dynamic variation photo update
      const updateProductPhotoForSelection = () => {
        if (!imgElem) return;
        const currentTam = tamSelect ? tamSelect.value : "";
        const currentCor = corSelect ? corSelect.value : "";
        const varPhoto = getVariationPhoto(prod, varMap, currentTam, currentCor);
        const originalSrc = imgElem.dataset.originalSrc || (Array.isArray(prod.url) ? prod.url[0] : prod.url);
        
        if (varPhoto) {
          imgElem.src = varPhoto;
        } else if (originalSrc) {
          imgElem.src = originalSrc;
        }
      };

      if (tamSelect && corSelect && varMap.hasSizes && varMap.hasColors) {
        // Function to update color dropdown options according to selected size
        const updateColorsForSelectedSize = (keepSelectedCor = true) => {
          const selectedSize = tamSelect.value;
          const availableColors = (varMap.sizeToColors[selectedSize] && varMap.sizeToColors[selectedSize].length > 0)
            ? varMap.sizeToColors[selectedSize]
            : varMap.colors;
          const currentSelectedCor = corSelect.value;

          corSelect.innerHTML = availableColors
            .map(c => `<option value="${c}">${c}</option>`)
            .join("");

          if (keepSelectedCor && availableColors.includes(currentSelectedCor)) {
            corSelect.value = currentSelectedCor;
          } else if (availableColors.length > 0) {
            corSelect.value = availableColors[0];
          }
          updateProductPhotoForSelection();
        };

        // Function to update size dropdown or auto-switch size according to selected color
        const updateSizesForSelectedColor = () => {
          const selectedColor = corSelect.value;
          const availableSizes = (varMap.colorToSizes[selectedColor] && varMap.colorToSizes[selectedColor].length > 0)
            ? varMap.colorToSizes[selectedColor]
            : varMap.sizes;
          const currentSelectedSize = tamSelect.value;

          if (!availableSizes.includes(currentSelectedSize) && availableSizes.length > 0) {
            tamSelect.value = availableSizes[0];
            updateColorsForSelectedSize(true);
          } else {
            updateProductPhotoForSelection();
          }
        };

        tamSelect.addEventListener("change", () => {
          updateColorsForSelectedSize(false);
        });

        corSelect.addEventListener("change", () => {
          updateSizesForSelectedColor();
        });

        // Initialize state
        updateColorsForSelectedSize(true);
      } else if (tamSelect || corSelect) {
        if (tamSelect) tamSelect.addEventListener("change", updateProductPhotoForSelection);
        if (corSelect) corSelect.addEventListener("change", updateProductPhotoForSelection);
        updateProductPhotoForSelection();
      }
    });
  } catch (error) {
    console.error("Erro ao carregar os produtos:", error);
  }
}

carregarProdutos();

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("zoom-modal");
  const imgAmpliada = document.getElementById("img-ampliada");
  const botaoFechar = document.querySelector(".zoom-fechar");
  const btnPrev = document.getElementById("zoom-prev");
  const btnNext = document.getElementById("zoom-next");

  // VARIÁVEIS DE ESTADO DA GALERIA NO ZOOM
  let imagensGaleriaAtual = []; // Armazena a lista de URLs (src) da galeria aberta
  let indiceImagemAtual = 0; // Índice da imagem que está sendo exibida

  // --- FUNÇÕES DE LÓGICA DO ZOOM ---

  // 1. Função para abrir o zoom e configurar a galeria
  const abrirZoomComGaleria = (urlClicada, listaDeImagens) => {
    imagensGaleriaAtual = listaDeImagens;
    // Encontra o índice da imagem clicada na lista para começar por ela
    indiceImagemAtual = imagensGaleriaAtual.indexOf(urlClicada);

    if (indiceImagemAtual === -1) indiceImagemAtual = 0; // Fallback de segurança

    imgAmpliada.src = imagensGaleriaAtual[indiceImagemAtual];

    // Adiciona classe se for uma galeria (tem mais de 1 imagem)
    if (imagensGaleriaAtual.length > 1) {
      modal.classList.add("tem-galeria");
    } else {
      modal.classList.remove("tem-galeria");
    }

    modal.style.display = "flex"; // Usa flex para centralizar
    document.body.style.overflow = "hidden";
  };

  // 2. Função para fechar o zoom
  const fecharZoom = () => {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
    imgAmpliada.src = "";
    imagensGaleriaAtual = []; // Limpa o estado
    indiceImagemAtual = 0;
  };

  // 3. Função para mudar a imagem (Anterior / Próxima)
  const mudarImagemZoom = (direcao) => {
    if (imagensGaleriaAtual.length <= 1) return; // Nada a fazer se não for galeria

    indiceImagemAtual += direcao;

    // Lógica de loop (ir do fim para o começo e vice-versa)
    if (indiceImagemAtual >= imagensGaleriaAtual.length) {
      indiceImagemAtual = 0; // Volta para a primeira
    } else if (indiceImagemAtual < 0) {
      indiceImagemAtual = imagensGaleriaAtual.length - 1; // Vai para a última
    }

    imgAmpliada.src = imagensGaleriaAtual[indiceImagemAtual];
  };

  // --- CONFIGURAÇÃO DOS EVENTOS (LISTENERS) ---

  // A. ESCUTAR O CLIQUE NAS IMAGENS (Delegação de evento - Dinâmica)
  document.addEventListener("click", (event) => {
    const alvo = event.target;

    // Verifica se o clique foi na imagem principal do produto
    if (alvo.classList.contains("img-principal")) {
      const urlImagemAtual = alvo.src;
      let imagensDaGaleria = [];

      // Encontra os botões de seta do próprio card clicado
      const cardContainer = alvo.closest(".produto-card");
      const botaoSeta = cardContainer.querySelector(".seta-slider");

      if (botaoSeta) {
        // Mágica: Vamos capturar a lista completa de fotos que você já passou no atributo 'onclick' do botão!
        const atributoOnclick = botaoSeta.getAttribute("onclick");

        // Expressão regular para extrair o array de fotos de dentro do texto do onclick
        const regexArray = /\[.*?\]/;
        const resultadoMatch = atributoOnclick.match(regexArray);

        if (resultadoMatch) {
          // Converte o texto extraído de volta em um Array real do JS
          // Ex: '["img1.jpg", "img2.jpg"]' vira ["img1.jpg", "img2.jpg"]
          const caminhosRelativos = JSON.parse(
            resultadoMatch[0].replace(/&quot;/g, '"'),
          );

          // Como o navegador transforma caminhos relativos em URLs absolutas no 'src' da imagem da tela,
          // precisamos converter os caminhos do JSON para URLs absolutas também, assim o índice bate certinho!
          const linkInvisivel = document.createElement("a");
          imagensDaGaleria = caminhosRelativos.map((caminho) => {
            linkInvisivel.href = caminho;
            return linkInvisivel.href;
          });
        }
      }

      // Se o produto realmente não tiver outras fotos (não achou botão), usa só a foto atual
      if (imagensDaGaleria.length === 0) {
        imagensDaGaleria = [urlImagemAtual];
      }

      abrirZoomComGaleria(urlImagemAtual, imagensDaGaleria);
    }
  });

  // B. EVENTOS DOS BOTÕES DO MODAL
  if (botaoFechar) botaoFechar.addEventListener("click", fecharZoom);
  if (btnPrev) btnPrev.addEventListener("click", () => mudarImagemZoom(-1)); // Anterior
  if (btnNext) btnNext.addEventListener("click", () => mudarImagemZoom(1)); // Próximo

  // Fechar ao clicar na área escura
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        fecharZoom();
      }
    });
  }

  // Navegação via Teclado (Esc, Setas)
  document.addEventListener("keydown", (event) => {
    if (modal && modal.style.display === "flex") {
      if (event.key === "Escape") fecharZoom();
      if (event.key === "ArrowLeft") mudarImagemZoom(-1);
      if (event.key === "ArrowRight") mudarImagemZoom(1);
    }
  });
});

async function carregarCategoriasCatalogo() {
  const listElement = document.getElementById("category-list");
  if (!listElement) return;

  const setor = listElement.dataset.setor;
  if (!setor) return;

  try {
    const timestamp = Date.now();
    const response = await fetch(`/api/categories/${setor}?_t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) return;

    const categories = await response.json();
    const activeCategories = Array.isArray(categories)
      ? categories.filter((cat) => Number(cat.qtdItens) > 0)
      : [];

    if (activeCategories.length === 0) {
      listElement.innerHTML = `
        <li style="text-align: center; color: #888; padding: 15px; font-style: italic;">
          Nenhum produto disponível no momento nesta seção.
        </li>
      `;
      return;
    }

    listElement.innerHTML = activeCategories
      .map(
        (cat) => `
      <li>
        <a href="${cat.url}">${cat.nome}</a>
      </li>
    `
      )
      .join("");
  } catch (e) {
    console.error("Erro ao carregar categorias do catálogo:", e);
  }
}

function configurarLinksRetorno() {
  document.querySelectorAll(".div-2 a, a.btn-voltar-catalogo, a.link-retornar-anterior").forEach((link) => {
    const text = (link.textContent || "").toLowerCase();
    if (text.includes("retornar") || text.includes("voltar") || text.includes("anterior")) {
      // Ensure there's a valid href fallback
      if (!link.getAttribute("href") || link.getAttribute("href") === "#") {
        const container = document.getElementById("container-produtos") || document.getElementById("category-list");
        const setor = container ? container.dataset.setor : null;
        if (setor) {
          link.setAttribute("href", `/pages/${setor}/index.html`);
        } else {
          link.setAttribute("href", "/index.html");
        }
      }

      link.addEventListener("click", (e) => {
        // If the user arrived from the same domain, history.back() provides instant natural return
        if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
          e.preventDefault();
          window.history.back();
        }
      });
    }
  });

  // Ensure all footers have the Admin Link if not present
  document.querySelectorAll("footer .div-footer p").forEach((p) => {
    if (!p.querySelector('a[href*="admin"]') && !window.location.pathname.includes("/admin")) {
      const adminLinkSpan = document.createElement("span");
      adminLinkSpan.innerHTML = ` | <a href="/pages/admin/index.html" class="link-admin-footer" style="color: #5c1838; font-weight: bold; text-decoration: underline; padding: 2px 6px;">Painel Administrativo</a>`;
      p.appendChild(adminLinkSpan);
    }
  });
}

function sincronizarDadosCatalogo() {
  carregarProdutos();
  carregarCategoriasCatalogo();
  configurarLinksRetorno();
  if (window.VirtualCart && typeof window.VirtualCart.initUi === "function") {
    try {
      window.VirtualCart.initUi();
    } catch (e) {}
  }
}

document.addEventListener("DOMContentLoaded", sincronizarDadosCatalogo);

// Auto-initialize PWA & Virtual Cart
if (!document.querySelector('script[src*="pwa.js"]')) {
  const pwaScript = document.createElement('script');
  pwaScript.src = '/js/pwa.js';
  pwaScript.defer = true;
  document.head.appendChild(pwaScript);
}

if (!document.querySelector('script[src*="cart.js"]')) {
  const cartScript = document.createElement('script');
  cartScript.src = '/js/cart.js';
  cartScript.defer = true;
  cartScript.onload = () => {
    if (window.VirtualCart && typeof window.VirtualCart.initUi === "function") {
      window.VirtualCart.initUi();
    }
  };
  document.head.appendChild(cartScript);
} else if (window.VirtualCart && typeof window.VirtualCart.initUi === "function") {
  window.VirtualCart.initUi();
}

// Auto-sync catalog data on visibility change, focus, and iOS/Android bfcache pageshow
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    sincronizarDadosCatalogo();
  }
});
window.addEventListener("focus", sincronizarDadosCatalogo);
window.addEventListener("pageshow", (event) => {
  // If loaded from back-forward cache or regular navigation, refresh catalog
  sincronizarDadosCatalogo();
});

// Real-time broadcast sync across open tabs and windows
try {
  if ('BroadcastChannel' in window) {
    const syncChannel = new BroadcastChannel('catalogo_sync_channel');
    syncChannel.onmessage = (event) => {
      if (event.data && event.data.action === 'refresh') {
        sincronizarDadosCatalogo();
      }
    };
  }
} catch (e) {
  // BroadcastChannel fallback
}
