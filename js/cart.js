/**
 * Carrinho Virtual - Carol Alves
 * 100% Gratuito, Seguro e Direto via WhatsApp (sem intermediários ou custos)
 */

(function () {
  const STORAGE_KEY = "carol_alves_cart_v1";
  const CONFIG_CACHE_KEY = "carol_alves_public_config";
  let cachedConfig = null;

  // Initialize or fetch public store config (WhatsApp number)
  async function loadPublicConfig() {
    try {
      const res = await fetch(`/api/public-config?_t=${Date.now()}`);
      if (res.ok) {
        cachedConfig = await res.json();
        localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cachedConfig));
        return cachedConfig;
      }
    } catch (e) {
      // Fallback from cache
    }
    const local = localStorage.getItem(CONFIG_CACHE_KEY);
    if (local) {
      try {
        cachedConfig = JSON.parse(local);
        return cachedConfig;
      } catch (e) {}
    }
    cachedConfig = { whatsapp: "", storeName: "Carol Alves" };
    return cachedConfig;
  }

  // ==========================================
  // CART STATE MANAGEMENT
  // ==========================================
  const VirtualCart = {
    getItems: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    saveItems: function (items) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        this.notifyChange();
      } catch (e) {
        console.error("Erro ao salvar carrinho:", e);
      }
    },

    addItem: function (item) {
      this.initUi();
      const items = this.getItems();
      // Unique key based on ID + selected variations
      const uniqueKey = `${item.id || item.descricao}_${item.tamanho || ""}_${item.cor || ""}`;
      
      const existingIdx = items.findIndex((i) => i.uniqueKey === uniqueKey);

      if (existingIdx > -1) {
        items[existingIdx].quantidade = (items[existingIdx].quantidade || 1) + (item.quantidade || 1);
      } else {
        items.push({
          ...item,
          uniqueKey,
          quantidade: item.quantidade || 1,
          addedAt: Date.now()
        });
      }

      this.saveItems(items);
      this.showToast(`"${item.descricao}" adicionado ao carrinho!`);
      this.triggerBadgeAnimation();
      this.updateFloatingButtonBadge();
    },

    updateQuantity: function (uniqueKey, delta) {
      let items = this.getItems();
      const idx = items.findIndex((i) => i.uniqueKey === uniqueKey);
      if (idx > -1) {
        items[idx].quantidade += delta;
        if (items[idx].quantidade <= 0) {
          items.splice(idx, 1);
        }
        this.saveItems(items);
        this.renderDrawer();
      }
    },

    removeItem: function (uniqueKey) {
      let items = this.getItems();
      items = items.filter((i) => i.uniqueKey !== uniqueKey);
      this.saveItems(items);
      this.renderDrawer();
    },

    clearCart: function () {
      this.saveItems([]);
      this.renderDrawer();
    },

    getTotalCount: function () {
      const items = this.getItems();
      return items.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
    },

    getTotalPrice: function () {
      const items = this.getItems();
      return items.reduce((acc, curr) => acc + (Number(curr.valor || 0) * (curr.quantidade || 1)), 0);
    },

    notifyChange: function () {
      this.updateFloatingButtonBadge();
      try {
        if ("BroadcastChannel" in window) {
          const ch = new BroadcastChannel("cart_sync_channel");
          ch.postMessage({ action: "cart_updated", timestamp: Date.now() });
        }
      } catch (e) {}
    },

    // ==========================================
    // UI FEEDBACK & TOAST
    // ==========================================
    showToast: function (message) {
      let container = document.getElementById("cart-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "cart-toast-container";
        container.className = "cart-toast-container";
        document.body.appendChild(container);
      }

      const toast = document.createElement("div");
      toast.className = "cart-toast";
      toast.innerHTML = `
        <div class="cart-toast-icon">🛒</div>
        <div class="cart-toast-msg">${message}</div>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add("show");
      }, 10);

      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    triggerBadgeAnimation: function () {
      const btn = document.getElementById("cart-fab-btn");
      const badge = document.getElementById("cart-fab-badge");
      if (btn) {
        btn.classList.remove("cart-bump");
        void btn.offsetWidth; // Trigger reflow
        btn.classList.add("cart-bump");
      }
      if (badge) {
        badge.classList.remove("bounce");
        void badge.offsetWidth;
        badge.classList.add("bounce");
      }
    },

    updateFloatingButtonBadge: function () {
      const badge = document.getElementById("cart-fab-badge");
      const count = this.getTotalCount();
      if (badge) {
        badge.textContent = count;
        if (count > 0) {
          badge.classList.add("has-items");
        } else {
          badge.classList.remove("has-items");
        }
      }
    },

    // ==========================================
    // UI INJECTION: TOP-RIGHT MINIMALIST BUTTON & DRAWER
    // ==========================================
    isCategoryPage: function () {
      const path = (window.location.pathname || "").toLowerCase();
      // Exclude admin, maintenance, and root index
      if (path.includes("/admin") || path.includes("manutencao")) {
        return false;
      }
      if (path === "/" || path === "/index.html" || path.endsWith("/site-produtos/") || path.endsWith("/site-produtos/index.html")) {
        return false;
      }
      // Exclude category selection menu pages (e.g. /pages/semijoias/index.html or /pages/lingeries/index.html)
      if (
        path.endsWith("/semijoias/index.html") || 
        path.endsWith("/semijoias/") || 
        path.endsWith("/semijoias") ||
        path.endsWith("/lingeries/index.html") || 
        path.endsWith("/lingeries/") || 
        path.endsWith("/lingeries")
      ) {
        return false;
      }
      // If the category selection list or home links list is present, do not show cart
      if (document.getElementById("category-list") || document.getElementById("home-links-list")) {
        return false;
      }

      // Show ONLY on actual product category pages (e.g. aneis.html, calcinhas.html) with #container-produtos
      const hasProductGrid = !!document.getElementById("container-produtos");
      const isSubcategoryPage = (path.includes("/semijoias/") || path.includes("/lingeries/")) && !path.endsWith("/index.html") && !path.endsWith("index.html");
      return hasProductGrid || isSubcategoryPage;
    },

    initUi: function () {
      // Show ONLY on internal category pages (lingeries and semijoias)
      if (!this.isCategoryPage()) {
        document.getElementById("cart-fab-btn")?.remove();
        document.getElementById("cart-drawer-overlay")?.remove();
        return;
      }

      if (!document.body) {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => this.initUi());
        }
        return;
      }

      let fab = document.getElementById("cart-fab-btn");
      if (!fab) {
        fab = document.createElement("button");
        fab.type = "button";
        fab.id = "cart-fab-btn";
        fab.className = "cart-fab-btn";
        fab.setAttribute("title", "Ver Carrinho de Compras");
        fab.setAttribute("aria-label", "Ver Carrinho de Compras");
        fab.innerHTML = `
          <div class="cart-fab-icon-wrapper">
            <svg class="cart-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <span class="cart-fab-label">Carrinho</span>
          <span id="cart-fab-badge" class="cart-fab-badge">0</span>
        `;
        fab.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openDrawer();
        });
        document.body.appendChild(fab);
      }

      let overlay = document.getElementById("cart-drawer-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "cart-drawer-overlay";
        overlay.className = "cart-drawer-overlay";

        overlay.innerHTML = `
          <div class="cart-drawer" id="cart-drawer">
            <div class="cart-drawer-header">
              <div class="cart-drawer-title-wrap">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#5c1838" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <h3>Meu Carrinho</h3>
                <span id="cart-drawer-header-count" class="cart-count-pill">0</span>
              </div>
              <button type="button" class="cart-close-btn" id="btn-close-cart" aria-label="Fechar Carrinho">&times;</button>
            </div>

            <div class="cart-drawer-body" id="cart-drawer-body">
              <!-- Dynamically populated -->
            </div>

            <div class="cart-drawer-footer" id="cart-drawer-footer">
              <!-- Dynamically populated -->
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById("btn-close-cart")?.addEventListener("click", () => this.closeDrawer());
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) this.closeDrawer();
        });
      }

      this.updateFloatingButtonBadge();
      loadPublicConfig();
    },

    openDrawer: function () {
      const overlay = document.getElementById("cart-drawer-overlay");
      if (overlay) {
        this.renderDrawer();
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
      }
    },

    closeDrawer: function () {
      const overlay = document.getElementById("cart-drawer-overlay");
      if (overlay) {
        overlay.classList.remove("active");
        document.body.style.overflow = "";
      }
    },

    renderDrawer: function () {
      const body = document.getElementById("cart-drawer-body");
      const footer = document.getElementById("cart-drawer-footer");
      const headerCount = document.getElementById("cart-drawer-header-count");
      if (!body || !footer) return;

      const items = this.getItems();
      const totalCount = this.getTotalCount();
      const totalPrice = this.getTotalPrice();

      if (headerCount) headerCount.textContent = totalCount;

      if (items.length === 0) {
        body.innerHTML = `
          <div class="cart-empty-state">
            <div class="cart-empty-icon">🛍️</div>
            <h4>Seu carrinho está vazio</h4>
            <p>Escolha seus produtos favoritos no catálogo e adicione ao carrinho para enviar tudo em uma única mensagem!</p>
            <button type="button" class="btn-cart-continue" id="btn-cart-empty-continue">
              Continuar Navegando
            </button>
          </div>
        `;
        footer.innerHTML = "";
        document.getElementById("btn-cart-empty-continue")?.addEventListener("click", () => this.closeDrawer());
        return;
      }

      // Render Items
      body.innerHTML = `
        <div class="cart-items-list">
          ${items
            .map((item) => {
              const itemTotal = Number(item.valor || 0) * (item.quantidade || 1);
              const hasVariation = item.tamanho || item.cor;
              const photo = item.imagem || "/assets/img/placeholder.svg";

              return `
                <div class="cart-item-row" data-key="${item.uniqueKey}">
                  <div class="cart-item-thumb-wrapper">
                    <img src="${photo}" alt="${item.descricao}" class="cart-item-thumb" onerror="this.src='/assets/img/placeholder.svg'">
                  </div>
                  <div class="cart-item-details">
                    <div class="cart-item-title">${item.descricao}</div>
                    ${
                      hasVariation
                        ? `
                        <div class="cart-item-variations">
                          ${item.tamanho ? `<span class="cart-var-tag">Tam: <strong>${item.tamanho}</strong></span>` : ""}
                          ${item.cor ? `<span class="cart-var-tag">Cor: <strong>${item.cor}</strong></span>` : ""}
                        </div>
                      `
                        : ""
                    }
                    <div class="cart-item-price-unit">
                      R$ ${Number(item.valor || 0).toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                  <div class="cart-item-actions">
                    <div class="cart-qty-control">
                      <button type="button" class="cart-btn-qty btn-qty-minus" data-key="${item.uniqueKey}" title="Diminuir quantidade">−</button>
                      <span class="cart-qty-val">${item.quantidade}</span>
                      <button type="button" class="cart-btn-qty btn-qty-plus" data-key="${item.uniqueKey}" title="Aumentar quantidade">+</button>
                    </div>
                    <div class="cart-item-subtotal">
                      R$ ${itemTotal.toFixed(2).replace(".", ",")}
                    </div>
                    <button type="button" class="cart-btn-remove" data-key="${item.uniqueKey}" title="Remover item">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <!-- CUSTOMER FORM INFO -->
        <div class="cart-customer-box">
          <div class="cart-box-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#5c1838" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Dados para o Atendimento (Opcional)
          </div>
          <div class="cart-form-group">
            <label for="cart-input-nome">Seu Nome:</label>
            <input type="text" id="cart-input-nome" class="cart-input" placeholder="Ex: Maria Santos" value="${localStorage.getItem("cart_customer_name") || ""}">
          </div>
          <div class="cart-form-group">
            <label for="cart-select-pagamento">Forma de Pagamento Preferida:</label>
            <select id="cart-select-pagamento" class="cart-input">
              <option value="">Não definir agora (combinar no WhatsApp)</option>
              <option value="PIX">PIX (Chave ou QR Code)</option>
              <option value="Cartão de Crédito / Débito">Cartão de Crédito / Débito</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>
          <div class="cart-form-group">
            <label for="cart-input-obs">Observações / Entrega / Dúvidas:</label>
            <textarea id="cart-input-obs" class="cart-input" rows="2" placeholder="Ex: Gostaria de saber o valor da entrega para o centro."></textarea>
          </div>
        </div>
      `;

      // Render Footer
      footer.innerHTML = `
        <div class="cart-summary-card">
          <div class="cart-summary-row">
            <span>Quantidade de Itens:</span>
            <strong>${totalCount}</strong>
          </div>
          <div class="cart-summary-total">
            <span>Total do Pedido:</span>
            <span class="cart-total-value">R$ ${totalPrice.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>

        <div class="cart-footer-actions">
          <button type="button" class="btn-cart-whatsapp" id="btn-send-whatsapp-order">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.072-1.042-.061-.631-.205-1.442-.647-2.483-1.688-1.325-1.325-1.854-2.433-2.029-2.85-.175-.417-.017-.643.109-.811.11-.148.243-.342.365-.487.122-.144.163-.245.244-.407.081-.162.041-.305-.02-.427-.061-.122-.55-1.325-.753-1.814-.198-.475-.399-.411-.55-.419l-.468-.008c-.163 0-.427.061-.65.305-.224.244-.854.834-.854 2.035 0 1.2 1.057 2.36 1.209 2.563.152.203 2.079 3.175 5.038 4.453.704.305 1.254.487 1.683.623.708.225 1.353.193 1.862.117.568-.085 1.748-.715 1.992-1.404.244-.689.244-1.28.171-1.404-.073-.122-.268-.195-.568-.345z"></path>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.66 1.443 5.176L2 22l4.981-1.309A9.957 9.957 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.05c-1.637 0-3.157-.45-4.463-1.233l-.32-.192-3.308.868.883-3.226-.21-.334A8.005 8.005 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8.05-8 8.05z"></path>
            </svg>
            <span>Enviar Pedido via WhatsApp</span>
          </button>

          <div class="cart-secondary-actions">
            <button type="button" class="btn-cart-text" id="btn-cart-clear-all">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Limpar Carrinho
            </button>
            <button type="button" class="btn-cart-text" id="btn-cart-keep-shopping">
              Continuar Comprando &rarr;
            </button>
          </div>
        </div>
      `;

      // Bind dynamic actions
      body.querySelectorAll(".btn-qty-minus").forEach((btn) => {
        btn.addEventListener("click", () => this.updateQuantity(btn.dataset.key, -1));
      });

      body.querySelectorAll(".btn-qty-plus").forEach((btn) => {
        btn.addEventListener("click", () => this.updateQuantity(btn.dataset.key, 1));
      });

      body.querySelectorAll(".cart-btn-remove").forEach((btn) => {
        btn.addEventListener("click", () => this.removeItem(btn.dataset.key));
      });

      document.getElementById("btn-cart-clear-all")?.addEventListener("click", () => {
        if (confirm("Deseja realmente remover todos os itens do carrinho?")) {
          this.clearCart();
        }
      });

      document.getElementById("btn-cart-keep-shopping")?.addEventListener("click", () => this.closeDrawer());

      document.getElementById("btn-send-whatsapp-order")?.addEventListener("click", () => this.sendOrderToWhatsApp());
    },

    // ==========================================
    // SEND ORDER VIA DIRECT WHATSAPP (100% FREE)
    // ==========================================
    sendOrderToWhatsApp: async function () {
      const items = this.getItems();
      if (items.length === 0) {
        alert("Seu carrinho está vazio!");
        return;
      }

      const nomeCliente = document.getElementById("cart-input-nome")?.value.trim() || "";
      const formaPagamento = document.getElementById("cart-select-pagamento")?.value || "";
      const observacoes = document.getElementById("cart-input-obs")?.value.trim() || "";

      if (nomeCliente) {
        localStorage.setItem("cart_customer_name", nomeCliente);
      }

      // Ensure we have latest WhatsApp config
      if (!cachedConfig || !cachedConfig.whatsapp) {
        await loadPublicConfig();
      }

      let phone = cachedConfig?.whatsapp || "";
      phone = String(phone).replace(/\D/g, "");

      // If still no phone configured in admin, prompt customer or use fallback
      if (!phone) {
        phone = "55"; // Generic fallback or asks if needed
      }

      const totalPrice = this.getTotalPrice();
      const totalCount = this.getTotalCount();

      // Format elegant WhatsApp message
      let msg = `🛍️ *NOVO PEDIDO - CATÁLOGO CAROL ALVES*\n\n`;
      msg += `Olá Carol! Gostaria de encomendar os seguintes itens do catálogo:\n\n`;

      items.forEach((item, index) => {
        const itemTotal = Number(item.valor || 0) * (item.quantidade || 1);
        msg += `*${index + 1}. ${item.quantidade}x ${item.descricao}*\n`;
        
        let varDetails = [];
        if (item.tamanho) varDetails.push(`Tamanho: ${item.tamanho}`);
        if (item.cor) varDetails.push(`Cor: ${item.cor}`);
        if (varDetails.length > 0) {
          msg += `   ▫️ ${varDetails.join(" | ")}\n`;
        }

        if (item.quantidade > 1) {
          msg += `   ▫️ Valor un: R$ ${Number(item.valor || 0).toFixed(2).replace(".", ",")} (Subtotal: R$ ${itemTotal.toFixed(2).replace(".", ",")})\n\n`;
        } else {
          msg += `   ▫️ Valor: R$ ${itemTotal.toFixed(2).replace(".", ",")}\n\n`;
        }
      });

      msg += `─────────────────────────\n`;
      msg += `📦 *Total de Itens:* ${totalCount}\n`;
      msg += `💰 *VALOR TOTAL:* *R$ ${totalPrice.toFixed(2).replace(".", ",")}*\n`;
      msg += `─────────────────────────\n\n`;

      if (nomeCliente) {
        msg += `👤 *Cliente:* ${nomeCliente}\n`;
      }
      if (formaPagamento) {
        msg += `💳 *Forma de Pagamento:* ${formaPagamento}\n`;
      }
      if (observacoes) {
        msg += `📝 *Observações / Entrega:* ${observacoes}\n`;
      }

      msg += `\nPoderia por gentileza confirmar a disponibilidade e o prazo de entrega? Muito obrigado(a)! ✨`;

      const encodedMsg = encodeURIComponent(msg);
      
      let whatsappUrl = "";
      if (phone && phone.length >= 8) {
        whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
      } else {
        whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
      }

      window.open(whatsappUrl, "_blank");
    }
  };

  // Expose globally
  window.VirtualCart = VirtualCart;

  // Immediate and multi-event initialization
  function safeInit() {
    try {
      VirtualCart.initUi();
    } catch (e) {
      console.error("Erro ao inicializar VirtualCart UI:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }
  window.addEventListener("load", safeInit);
  window.addEventListener("pageshow", safeInit);

  // Cross-tab synchronization
  try {
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("cart_sync_channel");
      ch.onmessage = (e) => {
        if (e.data && e.data.action === "cart_updated") {
          VirtualCart.updateFloatingButtonBadge();
          if (document.getElementById("cart-drawer-overlay")?.classList.contains("active")) {
            VirtualCart.renderDrawer();
          }
        }
      };
    }
  } catch (e) {}

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      VirtualCart.updateFloatingButtonBadge();
      if (document.getElementById("cart-drawer-overlay")?.classList.contains("active")) {
        VirtualCart.renderDrawer();
      }
    }
  });
})();
