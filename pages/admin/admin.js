// Admin Panel Logic
document.addEventListener("DOMContentLoaded", () => {
  let state = {
    isAuthenticated: sessionStorage.getItem("admin_auth") === "true",
    userEmail: sessionStorage.getItem("admin_email") || "",
    categories: { semijoias: [], lingeries: [] },
    activeCategory: { semijoias: "", lingeries: "" },
    products: { semijoias: [], lingeries: [] },
    multiSelectMode: { semijoias: false, lingeries: false },
    selectedProductIds: { semijoias: new Set(), lingeries: new Set() },
    links: [],
    images: [],
    editingImages: [], // holds URLs for product form currently open
    trash: [],
    pendingDelete: null
  };

  // DOM Elements
  const loginScreen = document.getElementById("login-screen");
  const adminApp = document.getElementById("admin-app");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const emailInput = document.getElementById("email-input");
  const pinInput = document.getElementById("pin-input");
  const userEmailSpan = document.getElementById("user-email-span");

  // Force clean credentials function
  const purgeLoginFields = () => {
    if (!state.isAuthenticated) {
      if (emailInput) emailInput.value = "";
      if (pinInput) pinInput.value = "";
      if (loginForm) loginForm.reset();
    }
  };

  // Clear inputs on page start & prevent automatic browser credential injection
  purgeLoginFields();
  setTimeout(purgeLoginFields, 50);
  setTimeout(purgeLoginFields, 200);
  setTimeout(purgeLoginFields, 600);

  window.addEventListener("pageshow", () => {
    if (!state.isAuthenticated) {
      purgeLoginFields();
    }
  });

  // Promo checkbox listener
  const promoCheckbox = document.getElementById("prod-promocao");
  const promoPriceGroup = document.getElementById("group-preco-promocional");
  if (promoCheckbox && promoPriceGroup) {
    promoCheckbox.addEventListener("change", () => {
      promoPriceGroup.style.display = promoCheckbox.checked ? "block" : "none";
    });
  }

  // Authentication check
  if (state.isAuthenticated) {
    showAdminApp();
  } else {
    loginScreen.style.display = "block";
    adminApp.style.display = "none";
    if (emailInput) emailInput.value = "";
    if (pinInput) pinInput.value = "";
  }

  // Handle Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = "none";
      const email = emailInput ? emailInput.value.trim() : "";
      const pin = pinInput ? pinInput.value.trim() : "";

      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, pin })
        });
        const data = await res.json();

        if (data.success) {
          const userEmail = data.user?.email || email || "";
          sessionStorage.setItem("admin_auth", "true");
          sessionStorage.setItem("admin_email", userEmail);

          state.isAuthenticated = true;
          state.userEmail = userEmail;
          showAdminApp();
        } else {
          if (loginError) {
            loginError.textContent = data.message || "Credenciais inválidas!";
            loginError.style.display = "block";
          }
        }
      } catch (err) {
        if (loginError) {
          loginError.textContent = "Erro de conexão ao servidor.";
          loginError.style.display = "block";
        }
      }
    });
  }

  // Handle Logout
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_email");
    localStorage.removeItem("admin_auth");
    localStorage.removeItem("admin_email");
    if (emailInput) emailInput.value = "";
    if (pinInput) pinInput.value = "";
    window.location.href = "/index.html";
  });

  // Handle Credentials / Change PIN & WhatsApp Modal
  document.getElementById("btn-change-pin")?.addEventListener("click", async () => {
    const emailNewInput = document.getElementById("email-new");
    const whatsappInput = document.getElementById("whatsapp-admin");
    if (emailNewInput) {
      emailNewInput.value = state.userEmail || "";
    }
    // Fetch latest email and whatsapp from server
    try {
      const res = await fetch(`/api/admin/info?_t=${Date.now()}`);
      const data = await res.json();
      if (data) {
        if (data.email && emailNewInput) {
          emailNewInput.value = data.email;
          state.userEmail = data.email;
        }
        if (whatsappInput) {
          whatsappInput.value = data.whatsapp || "";
        }
      }
    } catch (e) {}
    resetPasswordToggles(document.getElementById("modal-pin"));
    openModal("modal-pin");
  });

  document.getElementById("form-pin")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPin = document.getElementById("pin-current")?.value;
    const newEmail = document.getElementById("email-new") ? document.getElementById("email-new").value : "";
    const newPin = document.getElementById("pin-new")?.value;
    const whatsapp = document.getElementById("whatsapp-admin") ? document.getElementById("whatsapp-admin").value.trim() : "";

    try {
      const res = await fetch("/api/admin/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newEmail, newPin, whatsapp })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        if (data.user?.email) {
          state.userEmail = data.user.email;
          sessionStorage.setItem("admin_email", data.user.email);
          if (localStorage.getItem("admin_auth") === "true") {
            localStorage.setItem("admin_email", data.user.email);
          }
          if (userEmailSpan) userEmailSpan.textContent = data.user.email;
        }
        alert("Configurações e credenciais salvas com sucesso!");
        closeModal("modal-pin");
        document.getElementById("form-pin").reset();
        resetPasswordToggles(document.getElementById("modal-pin"));
      } else {
        alert(data.message || data.error || "Erro ao atualizar credenciais. Verifique se o PIN atual digitado está correto.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  });

  // Cross-device and cross-tab real-time sync notification helper
  function notifySync() {
    try {
      if ('BroadcastChannel' in window) {
        const syncChannel = new BroadcastChannel('catalogo_sync_channel');
        syncChannel.postMessage({ action: 'refresh', timestamp: Date.now() });
      }
    } catch (e) {}
  }

  // Auto-refresh admin panel data when returning to tab or window
  function refreshAdminData() {
    if (state.isAuthenticated) {
      loadCategories();
      loadLinks();
      loadTrash();
      if (state.activeCategory.semijoias) loadProducts("semijoias", state.activeCategory.semijoias);
      if (state.activeCategory.lingeries) loadProducts("lingeries", state.activeCategory.lingeries);
    }
  }

  window.addEventListener("focus", refreshAdminData);
  window.addEventListener("pageshow", refreshAdminData);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAdminData();
  });

  try {
    if ('BroadcastChannel' in window) {
      const syncChannel = new BroadcastChannel('catalogo_sync_channel');
      syncChannel.onmessage = (event) => {
        if (event.data && event.data.action === 'refresh') {
          refreshAdminData();
        }
      };
    }
  } catch (e) {}

  async function showAdminApp() {
    loginScreen.style.display = "none";
    adminApp.style.display = "block";
    
    // Sync actual email from server
    try {
      const res = await fetch(`/api/admin/info?_t=${Date.now()}`);
      const data = await res.json();
      if (data && data.email) {
        state.userEmail = data.email;
        sessionStorage.setItem("admin_email", data.email);
      }
    } catch (e) {}

    if (userEmailSpan) {
      userEmailSpan.textContent = state.userEmail || sessionStorage.getItem("admin_email") || "Administrador";
    }
    loadCategories();
    loadLinks();
    loadGalleryImages();
    loadTrash();
  }

  // Tab Switching
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => (c.style.display = "none"));

      btn.classList.add("active");
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.style.display = "block";

      if (btn.dataset.tab === "tab-lixeira") {
        loadTrash();
      }
    });
  });

  // Load Categories
  async function loadCategories() {
    try {
      const res = await fetch(`/api/categories?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const data = await res.json();
      state.categories = data;

      renderCategoryPills("semijoias");
      renderCategoryPills("lingeries");
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  }

  function renderCategoryPills(setor) {
    const container = document.getElementById(`pills-${setor}`);
    if (!container) return;

    const categories = state.categories[setor] || [];
    if (categories.length === 0) {
      container.innerHTML = `<p style="color: #888; font-style: italic;">Nenhuma categoria encontrada.</p>`;
      return;
    }

    // Set active category if none selected
    if (!state.activeCategory[setor] && categories.length > 0) {
      state.activeCategory[setor] = categories[0].id;
    }

    container.innerHTML = categories
      .map(
        (cat) => `
      <button class="category-pill ${state.activeCategory[setor] === cat.id ? "active" : ""}" 
              data-setor="${setor}" data-cat="${cat.id}">
        <span>${cat.nome}</span>
        <span class="badge-count">${cat.qtdItens}</span>
      </button>
    `
      )
      .join("");

    // Add click listeners to category pills
    container.querySelectorAll(".category-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const cat = pill.dataset.cat;
        state.activeCategory[setor] = cat;
        renderCategoryPills(setor);
        loadProducts(setor, cat);
      });
    });

    // Auto load active category products
    if (state.activeCategory[setor]) {
      loadProducts(setor, state.activeCategory[setor]);
    }
  }

  // Helper function to update batch bar counts and buttons
  function updateBatchBarUI(setor) {
    const prefix = setor === "semijoias" ? "sj" : "lg";
    const selectedSet = state.selectedProductIds[setor];
    const count = selectedSet.size;

    const countSpan = document.getElementById(`selected-count-${prefix}`);
    if (countSpan) {
      countSpan.textContent = `(${count} selecionado${count !== 1 ? "s" : ""})`;
    }

    const badgeSpan = document.querySelector(`.count-badge-${prefix}`);
    if (badgeSpan) {
      badgeSpan.textContent = count;
    }

    const batchBtn = document.querySelector(`.btn-batch-delete[data-setor="${setor}"]`);
    if (batchBtn) {
      if (count > 0) {
        batchBtn.disabled = false;
        batchBtn.style.opacity = "1";
        batchBtn.style.cursor = "pointer";
      } else {
        batchBtn.disabled = true;
        batchBtn.style.opacity = "0.6";
        batchBtn.style.cursor = "not-allowed";
      }
    }

    const selectAllBtn = document.getElementById(`select-all-${prefix}`);
    if (selectAllBtn) {
      const items = getFilteredProducts(setor);
      selectAllBtn.checked = items.length > 0 && items.every((p) => selectedSet.has(String(p.id)));
    }
  }

  function getFilteredProducts(setor) {
    const searchId = setor === "semijoias" ? "search-sj" : "search-lg";
    const filterId = setor === "semijoias" ? "filter-status-sj" : "filter-status-lg";

    const searchTerm = (document.getElementById(searchId)?.value || "").toLowerCase();
    const filterStatus = document.getElementById(filterId)?.value || "todos";

    let items = state.products[setor] || [];
    return items.filter((item) => {
      const matchesSearch =
        (item.descricao || '').toLowerCase().includes(searchTerm) ||
        (item.informacoes && item.informacoes.toLowerCase().includes(searchTerm));
      const matchesStatus = filterStatus === "todos" || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }

  // Multi-select toggle setup for Semijoias and Lingeries
  ["sj", "lg"].forEach((prefix) => {
    const setor = prefix === "sj" ? "semijoias" : "lingeries";

    // Toggle Multi Select Checkbox (next to Novo Produto)
    const toggleBtn = document.getElementById(`toggle-multi-${prefix}`);
    const batchBar = document.getElementById(`batch-bar-${prefix}`);

    if (toggleBtn) {
      toggleBtn.addEventListener("change", () => {
        state.multiSelectMode[setor] = toggleBtn.checked;
        state.selectedProductIds[setor].clear();
        if (batchBar) {
          batchBar.style.display = toggleBtn.checked ? "flex" : "none";
        }
        updateBatchBarUI(setor);
        renderProducts(setor);
      });
    }

    // Select All Checkbox inside Batch Bar
    const selectAllBtn = document.getElementById(`select-all-${prefix}`);
    if (selectAllBtn) {
      selectAllBtn.addEventListener("change", () => {
        const isChecked = selectAllBtn.checked;
        const visibleItems = getFilteredProducts(setor);
        if (isChecked) {
          visibleItems.forEach((p) => state.selectedProductIds[setor].add(String(p.id)));
        } else {
          state.selectedProductIds[setor].clear();
        }
        updateBatchBarUI(setor);
        renderProducts(setor);
      });
    }

    // Batch Delete Action Button
    const batchDeleteBtn = document.querySelector(`.btn-batch-delete[data-setor="${setor}"]`);
    if (batchDeleteBtn) {
      batchDeleteBtn.addEventListener("click", () => {
        requestBatchDeleteProducts(setor);
      });
    }
  });

  function requestBatchDeleteProducts(setor) {
    const categoria = state.activeCategory[setor];
    const selectedIds = Array.from(state.selectedProductIds[setor]);
    if (selectedIds.length === 0) return;

    state.pendingDelete = {
      setor,
      categoria,
      isBatch: true,
      ids: selectedIds
    };

    document.getElementById("confirm-delete-title").textContent = "Excluir Vários Produtos";
    document.getElementById("confirm-delete-message").textContent = `Tem certeza que deseja mover os ${selectedIds.length} produtos selecionados para a Lixeira?`;
    document.getElementById("btn-confirm-delete-action").innerHTML = `<i class="fas fa-trash-alt"></i> Mover ${selectedIds.length} Itens para a Lixeira`;
    openModal("modal-confirm-delete");
  }

  // Load Products for category
  async function loadProducts(setor, categoria) {
    const gridId = setor === "semijoias" ? "grid-sj" : "grid-lg";
    const grid = document.getElementById(gridId);
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">Carregando produtos...</p>`;

    try {
      const res = await fetch(`/api/products/${setor}/${categoria}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const data = await res.json();
      state.products[setor] = Array.isArray(data) ? data : [];

      renderProducts(setor);
    } catch (err) {
      grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Erro ao carregar produtos.</p>`;
    }
  }

  function renderProducts(setor) {
    const gridId = setor === "semijoias" ? "grid-sj" : "grid-lg";
    const grid = document.getElementById(gridId);

    let items = getFilteredProducts(setor);

    // Update Stats
    updateStats(setor);

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">
          <i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 10px; color: #ccc;"></i>
          <p style="font-style: normal;">Nenhum produto encontrado nesta categoria.</p>
        </div>
      `;
      return;
    }

    const isMultiMode = state.multiSelectMode[setor];

    grid.innerHTML = items
      .map((item) => {
        // Image resolution
        let thumbUrl = Array.isArray(item.url) ? item.url[0] : item.url;
        if (!thumbUrl || thumbUrl.trim() === "") thumbUrl = "/assets/img/placeholder.svg";

        const isVendido = item.status === "vendido";
        const isSelected = state.selectedProductIds[setor].has(String(item.id));

        let priceDisplay = `R$ ${Number(item.valor || 0).toFixed(2)}`;
        if (item.emPromocao && item.precoPromocional && Number(item.precoPromocional) > 0) {
          priceDisplay = `<span style="text-decoration: line-through; color: #888; font-size: 0.85em; margin-right: 6px;">R$ ${Number(item.valor || 0).toFixed(2)}</span> <span style="color: #e53935; font-weight: bold;">R$ ${Number(item.precoPromocional).toFixed(2)}</span>`;
        }

        let optionsTags = '';
        if (Array.isArray(item.variacoes) && item.variacoes.length > 0) {
          const totalVars = item.variacoes.length;
          const dispVars = item.variacoes.filter(v => !v.vendido && (v.quantidade === undefined || Number(v.quantidade) > 0)).length;
          const varList = item.variacoes.map(v => {
            const t = Array.isArray(v.tamanhos) ? v.tamanhos.join(', ') : (v.tamanho || v.tamanhos || '');
            const c = Array.isArray(v.cores) ? v.cores.join(', ') : (v.cor || v.cores || '');
            const q = (v.quantidade !== undefined && v.quantidade !== null && v.quantidade !== "") ? Number(v.quantidade) : 1;
            const isSold = !!v.vendido || q <= 0;
            const label = [t, c].filter(Boolean).join(' - ') || 'Item';
            
            if (isSold) {
              return `<span style="background: #f8d7da; color: #842029; text-decoration: line-through; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 3px;" title="Vendido / Esgotado"><i class="fas fa-times"></i> ${label} (Vendido)</span>`;
            } else {
              return `<span style="background: #d1e7dd; color: #0f5132; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 3px;" title="${q} un. disponível(is)"><i class="fas fa-check"></i> ${label} (${q} un.)</span>`;
            }
          }).filter(Boolean).join(' ');

          if (varList) {
            optionsTags += `
              <div style="font-size: 0.75rem; color: #5c1838; margin-top: 5px; background: rgba(92,24,56,0.04); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(92,24,56,0.12);">
                <div style="font-weight: 700; margin-bottom: 4px; display: flex; justify-content: space-between;">
                  <span><i class="fas fa-layer-group"></i> Variações em Estoque:</span>
                  <span style="font-size: 0.7rem; color: ${dispVars > 0 ? '#198754' : '#dc3545'}; font-weight: bold;">${dispVars}/${totalVars} Disp.</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">${varList}</div>
              </div>
            `;
          }
        } else {
          const qProd = (item.quantidade !== undefined && item.quantidade !== null && item.quantidade !== "") ? Number(item.quantidade) : 1;
          let stockInfo = `<span style="font-size: 0.75rem; color: #666; background: #f0f0f0; padding: 2px 6px; border-radius: 4px;"><strong>Estoque:</strong> ${qProd} un.</span>`;
          
          let tamCorInfo = [];
          if (item.tamanhos && (Array.isArray(item.tamanhos) ? item.tamanhos.length : String(item.tamanhos).trim())) {
            const tamStr = Array.isArray(item.tamanhos) ? item.tamanhos.join(', ') : item.tamanhos;
            tamCorInfo.push(`<strong>Tam:</strong> ${tamStr}`);
          }
          if (item.cores && (Array.isArray(item.cores) ? item.cores.length : String(item.cores).trim())) {
            const corStr = Array.isArray(item.cores) ? item.cores.join(', ') : item.cores;
            tamCorInfo.push(`<strong>Cores:</strong> ${corStr}`);
          }
          
          optionsTags += `
            <div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              ${stockInfo}
              ${tamCorInfo.length > 0 ? `<span style="font-size: 0.75rem; color: #555;">${tamCorInfo.join(' &bull; ')}</span>` : ''}
            </div>
          `;
        }

        const selectOverlay = isMultiMode ? `
          <div style="position: absolute; top: 8px; right: 8px; z-index: 10; background: rgba(255, 255, 255, 0.95); padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); border: 1px solid #5c1838; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" class="prod-select-check" data-id="${item.id}" data-setor="${setor}" ${isSelected ? 'checked' : ''} style="accent-color: #5c1838; width: 18px; height: 18px; cursor: pointer;">
            <span style="font-size: 0.75rem; font-weight: bold; color: #5c1838;">Selecionar</span>
          </div>
        ` : '';

        const cardStyle = isSelected ? 'border: 2px solid #5c1838; background: #fff8f9;' : '';

        // Status badge calculation for variations
        const hasVars = Array.isArray(item.variacoes) && item.variacoes.length > 0;
        let statusBadgeHtml = '';
        let actionStatusBtn = '';

        if (hasVars) {
          const totalVars = item.variacoes.length;
          const dispVars = item.variacoes.filter(v => !v.vendido && (v.quantidade === undefined || Number(v.quantidade) > 0)).length;
          const isAllSold = dispVars === 0 || isVendido;
          const isPartial = dispVars > 0 && dispVars < totalVars;

          if (isAllSold) {
            statusBadgeHtml = `<span class="product-admin-status status-vendido" style="${item.emPromocao ? 'top: 28px;' : ''}">Vendido</span>`;
            actionStatusBtn = `
              <button class="admin-btn admin-btn-danger admin-btn-sm btn-manage-sold-vars" data-id="${item.id}" data-setor="${setor}" title="Gerenciar Vendas por Variação">
                <i class="fas fa-times-circle"></i> Variações (0/${totalVars})
              </button>
            `;
          } else if (isPartial) {
            statusBadgeHtml = `<span class="product-admin-status status-parcial" style="${item.emPromocao ? 'top: 28px;' : ''}">${dispVars}/${totalVars} Disp.</span>`;
            actionStatusBtn = `
              <button class="admin-btn admin-btn-warning admin-btn-sm btn-manage-sold-vars" data-id="${item.id}" data-setor="${setor}" style="background: #ffc107; color: #212529;" title="Gerenciar Vendas por Variação">
                <i class="fas fa-tags"></i> Variações (${dispVars}/${totalVars})
              </button>
            `;
          } else {
            statusBadgeHtml = `<span class="product-admin-status status-disponivel" style="${item.emPromocao ? 'top: 28px;' : ''}">Disponível</span>`;
            actionStatusBtn = `
              <button class="admin-btn admin-btn-success admin-btn-sm btn-manage-sold-vars" data-id="${item.id}" data-setor="${setor}" title="Gerenciar Vendas por Variação">
                <i class="fas fa-tags"></i> Variações (${dispVars}/${totalVars})
              </button>
            `;
          }
        } else {
          statusBadgeHtml = `
            <span class="product-admin-status ${isVendido ? "status-vendido" : "status-disponivel"}" style="${item.emPromocao ? 'top: 28px;' : ''}">
              ${isVendido ? "Vendido" : "Disponível"}
            </span>
          `;
          actionStatusBtn = `
            <button class="admin-btn ${isVendido ? "admin-btn-success" : "admin-btn-secondary"} admin-btn-sm btn-toggle-status" data-id="${item.id}" data-setor="${setor}" title="${isVendido ? "Marcar Disponível" : "Marcar Vendido"}">
              <i class="fas ${isVendido ? "fa-check-circle" : "fa-tag"}"></i> ${isVendido ? "Disponível" : "Vendido"}
            </button>
          `;
        }

        return `
        <div class="product-admin-card" data-id="${item.id}" style="position: relative; ${cardStyle}">
          ${selectOverlay}
          ${item.emPromocao ? '<div style="position: absolute; top: 0; left: 0; right: 0; background: #e53935; color: white; font-weight: 800; font-size: 0.65rem; text-align: center; padding: 3px 0; border-top-left-radius: 8px; border-top-right-radius: 8px; z-index: 5;">PROMOÇÃO</div>' : ''}
          ${statusBadgeHtml}
          <img src="${thumbUrl}" class="product-admin-thumb" alt="${item.descricao || 'Produto'}" onerror="this.src='/assets/img/placeholder.svg'" style="${item.emPromocao ? 'margin-top: 15px;' : ''}">
          <h4 class="product-admin-title">${item.descricao || 'Produto'}</h4>
          <div class="product-admin-price">${priceDisplay}</div>
          ${optionsTags}
          <div class="product-admin-info">${item.informacoes || "Sem detalhes adicionais."}</div>
          
          <div class="product-admin-actions">
            ${actionStatusBtn}
            <button class="admin-btn admin-btn-secondary admin-btn-sm btn-edit-product" data-id="${item.id}" data-setor="${setor}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="admin-btn admin-btn-danger admin-btn-sm btn-delete-product" data-id="${item.id}" data-setor="${setor}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    // Event listeners on dynamic product buttons
    grid.querySelectorAll(".btn-toggle-status").forEach((btn) => {
      btn.addEventListener("click", () => toggleProductStatus(setor, btn.dataset.id));
    });

    grid.querySelectorAll(".btn-manage-sold-vars").forEach((btn) => {
      btn.addEventListener("click", () => openSoldVariationsModal(setor, btn.dataset.id));
    });

    grid.querySelectorAll(".btn-edit-product").forEach((btn) => {
      btn.addEventListener("click", () => openEditProductModal(setor, btn.dataset.id));
    });

    grid.querySelectorAll(".btn-delete-product").forEach((btn) => {
      btn.addEventListener("click", () => requestDeleteProduct(setor, btn.dataset.id));
    });

    grid.querySelectorAll(".prod-select-check").forEach((chk) => {
      chk.addEventListener("change", () => {
        const id = String(chk.dataset.id);
        if (chk.checked) {
          state.selectedProductIds[setor].add(id);
        } else {
          state.selectedProductIds[setor].delete(id);
        }
        updateBatchBarUI(setor);
        renderProducts(setor);
      });
    });
  }

  function updateStats(setor) {
    const products = state.products[setor] || [];
    const total = products.length;
    const disponiveis = products.filter((p) => p.status !== "vendido").length;
    const vendidos = products.filter((p) => p.status === "vendido").length;
    const valorEstoque = products.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

    const prefix = setor === "semijoias" ? "sj" : "lg";
    document.getElementById(`stat-${prefix}-total`).textContent = total;
    document.getElementById(`stat-${prefix}-disp`).textContent = disponiveis;
    document.getElementById(`stat-${prefix}-vend`).textContent = vendidos;
    document.getElementById(`stat-${prefix}-val`).textContent = `R$ ${valorEstoque.toFixed(2)}`;
  }

  // Filter Listeners
  ["sj", "lg"].forEach((prefix) => {
    const setor = prefix === "sj" ? "semijoias" : "lingeries";
    document.getElementById(`search-${prefix}`)?.addEventListener("input", () => renderProducts(setor));
    document.getElementById(`filter-status-${prefix}`)?.addEventListener("change", () => renderProducts(setor));
  });

  // Toggle Product Status (Disponível <-> Vendido)
  async function toggleProductStatus(setor, id) {
    const categoria = state.activeCategory[setor];
    const item = state.products[setor].find((p) => String(p.id) === String(id));
    if (!item) return;

    // If product has variations, open granular sold variations modal
    if (Array.isArray(item.variacoes) && item.variacoes.length > 0) {
      openSoldVariationsModal(setor, id);
      return;
    }

    const newStatus = item.status === "vendido" ? "disponivel" : "vendido";

    try {
      const res = await fetch(`/api/products/${setor}/${categoria}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        item.status = newStatus;
        renderProducts(setor);
        notifySync();
      }
    } catch (err) {
      alert("Erro ao alterar status do produto.");
    }
  }

  // Delete Product Confirmation Flow
  function requestDeleteProduct(setor, id) {
    const categoria = state.activeCategory[setor];
    const item = (state.products[setor] || []).find((p) => String(p.id) === String(id));
    if (!item) return;

    state.pendingDelete = { setor, categoria, id, item };

    document.getElementById("confirm-delete-title").textContent = "Mover para Lixeira";
    document.getElementById("confirm-delete-message").textContent = `Tem certeza que deseja mover "${item.descricao || 'este produto'}" para a Lixeira?`;
    document.getElementById("btn-confirm-delete-action").innerHTML = `<i class="fas fa-trash-alt"></i> Mover para Lixeira`;
    openModal("modal-confirm-delete");
  }

  document.getElementById("btn-cancel-delete")?.addEventListener("click", () => {
    state.pendingDelete = null;
    closeModal("modal-confirm-delete");
  });

  document.getElementById("btn-confirm-delete-action")?.addEventListener("click", async () => {
    if (!state.pendingDelete) return;

    const { setor, categoria, id, isTrash, trashId, isBatch, ids } = state.pendingDelete;

    if (isBatch) {
      try {
        const res = await fetch(`/api/products/${setor}/${categoria}/batch-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          state.selectedProductIds[setor].clear();
          updateBatchBarUI(setor);
          closeModal("modal-confirm-delete");
          state.pendingDelete = null;
          await loadProducts(setor, categoria);
          await loadCategories();
          await loadTrash();
          notifySync();
        } else {
          alert(data.error || "Erro ao excluir produtos em lote.");
        }
      } catch (err) {
        alert("Erro ao conectar ao servidor.");
      }
      return;
    }

    if (isTrash) {
      try {
        const res = await fetch(`/api/admin/trash/${trashId}`, { method: "DELETE" });
        if (res.ok) {
          closeModal("modal-confirm-delete");
          state.pendingDelete = null;
          await loadTrash();
          notifySync();
        } else {
          alert("Erro ao excluir permanentemente.");
        }
      } catch (e) {
        alert("Erro na conexão.");
      }
      return;
    }

    try {
      const res = await fetch(`/api/products/${setor}/${categoria}/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        state.products[setor] = (state.products[setor] || []).filter((p) => String(p.id) !== String(id));
        renderProducts(setor);
        await loadCategories(); // update item count badge
        await loadTrash(); // update trash badge
        closeModal("modal-confirm-delete");
        state.pendingDelete = null;
        notifySync();
      } else {
        alert("Erro ao excluir produto.");
      }
    } catch (err) {
      alert("Erro ao conectar ao servidor.");
    }
  });

  // State for variation sold modal
  let currentSoldContext = null;

  function openSoldVariationsModal(setor, id) {
    const categoria = state.activeCategory[setor];
    const item = (state.products[setor] || []).find((p) => String(p.id) === String(id));
    if (!item) return;

    // Deep clone product variations
    const variacoes = Array.isArray(item.variacoes) ? JSON.parse(JSON.stringify(item.variacoes)) : [];
    if (variacoes.length === 0) {
      toggleProductStatus(setor, id);
      return;
    }

    currentSoldContext = {
      setor,
      categoria,
      id,
      item,
      variacoes: variacoes.map(v => ({
        ...v,
        quantidade: (v.quantidade !== undefined && v.quantidade !== null && v.quantidade !== "") ? Number(v.quantidade) : 1,
        vendido: !!v.vendido,
        foto: v.foto || ""
      }))
    };

    let mainThumb = Array.isArray(item.url) ? item.url[0] : item.url;
    if (!mainThumb || mainThumb.trim() === "") mainThumb = "/assets/img/placeholder.svg";

    document.getElementById("modal-sold-prod-title").innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${mainThumb}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; border: 1px solid #ddd;" alt="Thumb" onerror="this.src='/assets/img/placeholder.svg'">
        <div>
          <div style="font-weight: 700; color: #212529;">${item.descricao || 'Produto'}</div>
          <div style="font-size: 0.8rem; color: #666;">Valor: R$ ${Number(item.valor || 0).toFixed(2)} &bull; ${item.variacoes.length} variação(ões) cadastrada(s)</div>
        </div>
      </div>
    `;

    renderSoldVariationsList();
    openModal("modal-sold-variations");
  }

  function renderSoldVariationsList() {
    const container = document.getElementById("modal-sold-list");
    if (!container || !currentSoldContext) return;

    const { item, variacoes } = currentSoldContext;
    const defaultThumb = Array.isArray(item.url) ? item.url[0] : item.url || "/assets/img/placeholder.svg";

    let totalDisp = 0;
    let totalSold = 0;

    container.innerHTML = variacoes.map((v, idx) => {
      const isSold = !!v.vendido || (v.quantidade !== undefined && v.quantidade <= 0);
      if (isSold) totalSold++;
      else totalDisp++;

      const tamStr = Array.isArray(v.tamanhos) ? v.tamanhos.join(", ") : (v.tamanho || v.tamanhos || "Único");
      const corStr = Array.isArray(v.cores) ? v.cores.join(", ") : (v.cor || v.cores || "Padrão");
      const fotoUrl = v.foto || defaultThumb;
      const qtd = v.quantidade !== undefined ? Number(v.quantidade) : 1;

      return `
        <div class="sold-var-card ${isSold ? 'is-sold' : 'is-available'}" data-idx="${idx}">
          <img src="${fotoUrl}" class="sold-var-thumb" alt="${tamStr} - ${corStr}" onerror="this.src='/assets/img/placeholder.svg'">
          <div class="sold-var-info">
            <div class="sold-var-title">${tamStr} &bull; ${corStr}</div>
            <div class="sold-var-meta">
              <span class="sold-var-badge ${isSold ? 'badge-sold' : 'badge-disp'}">
                <i class="fas ${isSold ? 'fa-times-circle' : 'fa-check-circle'}"></i> ${isSold ? 'Vendido / Indisponível' : 'Disponível no Catálogo'}
              </span>
              <span style="font-size: 0.8rem; color: #555; display: inline-flex; align-items: center; gap: 4px;">
                <strong>Estoque:</strong>
                <input type="number" min="0" max="999" class="form-control sold-var-qtd" data-idx="${idx}" value="${qtd}" style="width: 55px; height: 28px; padding: 2px 6px; font-size: 0.82rem; text-align: center; display: inline-block;">
                un.
              </span>
            </div>
          </div>
          <button type="button" class="btn-toggle-var-sold ${isSold ? 'set-disp' : 'set-sold'}" data-idx="${idx}">
            <i class="fas ${isSold ? 'fa-undo' : 'fa-check'}"></i> ${isSold ? 'Marcar Disponível' : 'Marcar como Vendido'}
          </button>
        </div>
      `;
    }).join("");

    // Summary text
    const summary = document.getElementById("modal-sold-summary");
    if (summary) {
      summary.innerHTML = `
        <span style="color: #198754; font-weight: 700;"><i class="fas fa-check-circle"></i> ${totalDisp} disponível(is)</span>
        &bull;
        <span style="color: #dc3545; font-weight: 700;"><i class="fas fa-times-circle"></i> ${totalSold} vendida(s)</span>
        <span style="color: #888; font-size: 0.82rem;">(Total: ${variacoes.length})</span>
      `;
    }

    // Bind item toggle sold
    container.querySelectorAll(".btn-toggle-var-sold").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const v = currentSoldContext.variacoes[idx];
        if (v.vendido || (v.quantidade !== undefined && v.quantidade <= 0)) {
          v.vendido = false;
          if (!v.quantidade || v.quantidade <= 0) v.quantidade = 1;
        } else {
          v.vendido = true;
        }
        renderSoldVariationsList();
      });
    });

    // Bind quantity change
    container.querySelectorAll(".sold-var-qtd").forEach(input => {
      input.addEventListener("change", () => {
        const idx = parseInt(input.dataset.idx);
        const val = Math.max(0, parseInt(input.value) || 0);
        const v = currentSoldContext.variacoes[idx];
        v.quantidade = val;
        if (val === 0) {
          v.vendido = true;
        } else if (v.vendido && val > 0) {
          v.vendido = false;
        }
        renderSoldVariationsList();
      });
    });
  }

  // Sold modal helper buttons
  document.getElementById("btn-mark-all-disp")?.addEventListener("click", () => {
    if (!currentSoldContext) return;
    currentSoldContext.variacoes.forEach(v => {
      v.vendido = false;
      if (!v.quantidade || v.quantidade <= 0) v.quantidade = 1;
    });
    renderSoldVariationsList();
  });

  document.getElementById("btn-mark-all-sold")?.addEventListener("click", () => {
    if (!currentSoldContext) return;
    currentSoldContext.variacoes.forEach(v => {
      v.vendido = true;
    });
    renderSoldVariationsList();
  });

  document.getElementById("btn-save-sold-variations")?.addEventListener("click", async () => {
    if (!currentSoldContext) return;
    const { setor, categoria, id, item, variacoes } = currentSoldContext;

    const dispVars = variacoes.filter(v => !v.vendido && (v.quantidade === undefined || Number(v.quantidade) > 0)).length;
    const newStatus = dispVars === 0 ? "vendido" : "disponivel";

    try {
      const res = await fetch(`/api/products/${setor}/${categoria}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variacoes,
          status: newStatus
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success || data.product)) {
        item.variacoes = variacoes;
        item.status = newStatus;
        closeModal("modal-sold-variations");
        currentSoldContext = null;
        renderProducts(setor);
        notifySync();
      } else {
        alert(data.error || "Erro ao atualizar status das variações.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  });

  // Dynamic Variation Rows in Modal
  let activeVarPhotoTarget = null;

  function renderVarPhotoElement(row, foto) {
    const photoContainer = row.querySelector(".var-foto-container");
    const hiddenInput = row.querySelector(".var-foto");
    if (!photoContainer || !hiddenInput) return;

    hiddenInput.value = foto || "";

    if (foto && foto.trim() !== "") {
      photoContainer.innerHTML = `
        <div class="var-photo-thumb-wrapper" title="Clique para alterar a foto desta variação">
          <img src="${foto}" alt="Foto Variação" onerror="this.src='/assets/img/placeholder.svg'">
          <button type="button" class="var-photo-remove" title="Remover foto desta variação">&times;</button>
        </div>
      `;
      photoContainer.querySelector(".var-photo-thumb-wrapper").addEventListener("click", (e) => {
        if (e.target.classList.contains("var-photo-remove")) return;
        openVarPhotoSelector(row);
      });
      photoContainer.querySelector(".var-photo-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        renderVarPhotoElement(row, "");
      });
    } else {
      photoContainer.innerHTML = `
        <button type="button" class="var-photo-btn" title="Adicionar foto específica desta variação (opcional)">
          <i class="fas fa-camera"></i> <span style="font-size: 0.72rem;">Foto</span>
        </button>
      `;
      photoContainer.querySelector(".var-photo-btn").addEventListener("click", () => {
        openVarPhotoSelector(row);
      });
    }
  }

  async function openVarPhotoSelector(row) {
    activeVarPhotoTarget = row;
    await loadGalleryImages();

    const pickerGrid = document.getElementById("picker-grid");
    if (!pickerGrid) return;

    // Combine product's current editing images + gallery images
    const prodImages = (state.editingImages || []).filter(Boolean);
    const galleryImages = (state.images || []).filter(u => !prodImages.includes(u));

    let optionsHtml = `
      <div style="grid-column: 1/-1; margin-bottom: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" id="btn-var-no-photo" class="admin-btn admin-btn-secondary admin-btn-sm" style="font-size: 0.8rem;">
          <i class="fas fa-ban"></i> Sem foto específica (usar padrão)
        </button>
        <button type="button" id="btn-var-upload-new" class="admin-btn admin-btn-primary admin-btn-sm" style="font-size: 0.8rem;">
          <i class="fas fa-upload"></i> Enviar Nova Foto
        </button>
      </div>
    `;

    if (prodImages.length > 0) {
      optionsHtml += `
        <div style="grid-column: 1/-1; font-weight: 700; font-size: 0.85rem; color: #5c1838; margin-top: 4px;">
          Fotos deste Produto:
        </div>
      `;
      optionsHtml += prodImages.map(imgUrl => `
        <div style="border: 2px solid #5c1838; border-radius: 6px; overflow: hidden; cursor: pointer; position: relative;" class="picker-var-item" data-url="${imgUrl}">
          <img src="${imgUrl}" style="width: 100%; height: 90px; object-fit: cover;">
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(92,24,56,0.85); color: white; font-size: 0.68rem; text-align: center; padding: 2px;">Selecionar</div>
        </div>
      `).join("");
    }

    if (galleryImages.length > 0) {
      optionsHtml += `
        <div style="grid-column: 1/-1; font-weight: 700; font-size: 0.85rem; color: #495057; margin-top: 10px;">
          Banco de Imagens:
        </div>
      `;
      optionsHtml += galleryImages.map(imgUrl => `
        <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden; cursor: pointer;" class="picker-var-item" data-url="${imgUrl}">
          <img src="${imgUrl}" style="width: 100%; height: 90px; object-fit: cover;">
        </div>
      `).join("");
    }

    pickerGrid.innerHTML = optionsHtml;

    // Listeners
    pickerGrid.querySelectorAll(".picker-var-item").forEach(item => {
      item.addEventListener("click", () => {
        const url = item.dataset.url;
        if (activeVarPhotoTarget) {
          renderVarPhotoElement(activeVarPhotoTarget, url);
        }
        closeModal("modal-picker");
      });
    });

    document.getElementById("btn-var-no-photo")?.addEventListener("click", () => {
      if (activeVarPhotoTarget) {
        renderVarPhotoElement(activeVarPhotoTarget, "");
      }
      closeModal("modal-picker");
    });

    document.getElementById("btn-var-upload-new")?.addEventListener("click", () => {
      const tempInput = document.createElement("input");
      tempInput.type = "file";
      tempInput.accept = "image/*";
      tempInput.onchange = async () => {
        if (!tempInput.files || tempInput.files.length === 0) return;
        const formData = new FormData();
        formData.append("images", tempInput.files[0]);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (data.success && data.urls && data.urls[0]) {
            const newUrl = data.urls[0];
            state.editingImages.push(newUrl);
            renderImagePreviews();
            if (activeVarPhotoTarget) {
              renderVarPhotoElement(activeVarPhotoTarget, newUrl);
            }
            closeModal("modal-picker");
          } else {
            alert("Erro no envio da imagem.");
          }
        } catch (e) {
          alert("Falha no upload.");
        }
      };
      tempInput.click();
    });

    openModal("modal-picker");
  }

  function addVariacaoRow(tamanhosStr = "", coresStr = "", qtd = 1, foto = "", vendido = false) {
    const container = document.getElementById("variacoes-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "variacao-row";

    const safeQtd = (qtd !== undefined && qtd !== null && qtd !== "") ? Number(qtd) : 1;

    row.innerHTML = `
      <input type="hidden" class="var-foto" value="${foto || ''}">
      <input type="hidden" class="var-vendido" value="${vendido ? 'true' : 'false'}">
      <div>
        <label style="font-size: 0.72rem; font-weight: 600; color: #555; display: block; margin-bottom: 2px;">Tamanho(s)</label>
        <input type="text" class="form-control var-tam" placeholder="Ex: G ou Único" value="${tamanhosStr}" style="padding: 5px 8px; font-size: 0.82rem;" />
      </div>
      <div>
        <label style="font-size: 0.72rem; font-weight: 600; color: #555; display: block; margin-bottom: 2px;">Cores disponíveis</label>
        <input type="text" class="form-control var-cor" placeholder="Ex: Vermelho, Preto" value="${coresStr}" style="padding: 5px 8px; font-size: 0.82rem;" />
      </div>
      <div>
        <label style="font-size: 0.72rem; font-weight: 600; color: #555; display: block; margin-bottom: 2px;">Qtd (Estoque)</label>
        <input type="number" min="0" class="form-control var-qtd" placeholder="1" value="${safeQtd}" style="padding: 5px 6px; font-size: 0.82rem; text-align: center;" />
      </div>
      <div style="padding-top: 16px;">
        <div class="var-foto-container"></div>
      </div>
      <div style="padding-top: 16px;">
        <button type="button" class="btn-remove-var" title="Remover variação" style="background: #ffebee; border: 1px solid #ffcdd2; color: #c62828; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;

    renderVarPhotoElement(row, foto);

    row.querySelector(".btn-remove-var").addEventListener("click", () => {
      row.remove();
      if (container.children.length === 0) {
        addVariacaoRow("", "", 1, "", false);
      }
    });

    container.appendChild(row);
  }

  function renderVariacoesForm(item) {
    const container = document.getElementById("variacoes-container");
    if (!container) return;
    container.innerHTML = "";

    const prodQtdInput = document.getElementById("prod-quantidade");
    if (prodQtdInput) {
      prodQtdInput.value = (item && item.quantidade !== undefined && item.quantidade !== null && item.quantidade !== "") ? Number(item.quantidade) : 1;
    }

    if (item && Array.isArray(item.variacoes) && item.variacoes.length > 0) {
      item.variacoes.forEach((v) => {
        const tamStr = Array.isArray(v.tamanhos) ? v.tamanhos.join(", ") : (v.tamanho || v.tamanhos || "");
        const corStr = Array.isArray(v.cores) ? v.cores.join(", ") : (v.cor || v.cores || "");
        const qtdVal = (v.quantidade !== undefined && v.quantidade !== null && v.quantidade !== "") ? Number(v.quantidade) : 1;
        const fotoVal = v.foto || "";
        const vendidoVal = !!v.vendido;
        addVariacaoRow(tamStr, corStr, qtdVal, fotoVal, vendidoVal);
      });
    } else if (item && (item.tamanhos || item.cores)) {
      const tamStr = Array.isArray(item.tamanhos) ? item.tamanhos.join(", ") : (item.tamanhos || "");
      const corStr = Array.isArray(item.cores) ? item.cores.join(", ") : (item.cores || "");
      const qtdVal = (item.quantidade !== undefined && item.quantidade !== null) ? Number(item.quantidade) : 1;
      addVariacaoRow(tamStr, corStr, qtdVal, "", item.status === "vendido");
    } else {
      addVariacaoRow("", "", 1, "", false);
    }
  }

  function getVariacoesFromForm() {
    const rows = document.querySelectorAll("#variacoes-container .variacao-row");
    const variacoes = [];
    const tamanhosSet = new Set();
    const coresSet = new Set();

    rows.forEach((row) => {
      const tamVal = row.querySelector(".var-tam")?.value.trim() || "";
      const corVal = row.querySelector(".var-cor")?.value.trim() || "";
      const qtdValRaw = row.querySelector(".var-qtd")?.value;
      const qtdVal = (qtdValRaw !== undefined && qtdValRaw !== null && qtdValRaw !== "") ? Math.max(0, parseInt(qtdValRaw) || 0) : 1;
      const fotoVal = row.querySelector(".var-foto")?.value.trim() || "";
      const vendidoVal = row.querySelector(".var-vendido")?.value === "true";

      const rowTamanhos = tamVal ? tamVal.split(",").map(s => s.trim()).filter(Boolean) : [];
      const rowCores = corVal ? corVal.split(",").map(s => s.trim()).filter(Boolean) : [];

      if (rowTamanhos.length > 0 || rowCores.length > 0) {
        variacoes.push({
          tamanhos: rowTamanhos,
          cores: rowCores,
          quantidade: qtdVal,
          foto: fotoVal,
          vendido: vendidoVal
        });
        rowTamanhos.forEach(t => tamanhosSet.add(t));
        rowCores.forEach(c => coresSet.add(c));
      }
    });

    return {
      variacoes,
      tamanhos: Array.from(tamanhosSet),
      cores: Array.from(coresSet)
    };
  }

  document.getElementById("btn-add-variacao")?.addEventListener("click", () => {
    addVariacaoRow("", "", 1, "", false);
  });

  // Open Product Modal (Add or Edit)
  document.querySelectorAll(".btn-add-product").forEach((btn) => {
    btn.addEventListener("click", () => {
      const setor = btn.dataset.setor;
      const categoria = state.activeCategory[setor];

      if (!categoria) {
        alert("Selecione uma categoria primeiro.");
        return;
      }

      document.getElementById("modal-product-title").textContent = "Novo Produto";
      document.getElementById("form-product").reset();
      document.getElementById("prod-id").value = "";
      document.getElementById("prod-setor").value = setor;
      document.getElementById("prod-categoria").value = categoria;
      
      const prodQtd = document.getElementById("prod-quantidade");
      if (prodQtd) prodQtd.value = "1";

      if (promoCheckbox) promoCheckbox.checked = false;
      if (promoPriceGroup) promoPriceGroup.style.display = "none";
      document.getElementById("prod-preco-promocional").value = "";

      renderVariacoesForm(null);

      state.editingImages = [];
      renderImagePreviews();

      openModal("modal-product");
    });
  });

  function openEditProductModal(setor, id) {
    const categoria = state.activeCategory[setor];
    const item = state.products[setor].find((p) => String(p.id) === String(id));
    if (!item) return;

    document.getElementById("modal-product-title").textContent = "Editar Produto";
    document.getElementById("prod-id").value = item.id;
    document.getElementById("prod-setor").value = setor;
    document.getElementById("prod-categoria").value = categoria;
    document.getElementById("prod-descricao").value = item.descricao || "";
    document.getElementById("prod-valor").value = item.valor || "";
    document.getElementById("prod-status").value = item.status || "disponivel";
    document.getElementById("prod-info").value = item.informacoes || "";

    const prodQtd = document.getElementById("prod-quantidade");
    if (prodQtd) {
      prodQtd.value = (item.quantidade !== undefined && item.quantidade !== null && item.quantidade !== "") ? Number(item.quantidade) : 1;
    }

    const emPromo = !!item.emPromocao;
    if (promoCheckbox) promoCheckbox.checked = emPromo;
    if (promoPriceGroup) promoPriceGroup.style.display = emPromo ? "block" : "none";
    document.getElementById("prod-preco-promocional").value = item.precoPromocional || "";

    renderVariacoesForm(item);

    state.editingImages = Array.isArray(item.url) ? [...item.url] : item.url ? [item.url] : [];
    renderImagePreviews();

    openModal("modal-product");
  }

  // Handle Image Upload inside Product Modal
  const fileInput = document.getElementById("prod-file-input");
  const uploadBtn = document.getElementById("btn-upload-prod-img");
  uploadBtn?.addEventListener("click", () => fileInput?.click());

  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      if (!fileInput.files || fileInput.files.length === 0) return;

      const originalBtnHtml = uploadBtn ? uploadBtn.innerHTML : "";
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      }

      const formData = new FormData();
      for (let file of fileInput.files) {
        formData.append("images", file);
      }

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success && data.urls && data.urls.length > 0) {
          state.editingImages.push(...data.urls);
          renderImagePreviews();
        } else {
          alert(data.error || "Erro no processamento da imagem.");
        }
      } catch (err) {
        console.error("Upload error:", err);
        alert("Falha de comunicação no envio da imagem. Verifique o tamanho do arquivo ou sua conexão.");
      } finally {
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = originalBtnHtml;
        }
        fileInput.value = "";
      }
    });
  }

  // Manual Image URL input
  document.getElementById("prod-url-manual")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const url = e.target.value.trim();
      if (url) {
        state.editingImages.push(url);
        renderImagePreviews();
        e.target.value = "";
      }
    }
  });

  function renderImagePreviews() {
    const container = document.getElementById("prod-images-preview");
    if (!container) return;
    if (state.editingImages.length === 0) {
      container.innerHTML = `<p style="font-size: 0.85rem; color: #888;">Nenhuma imagem associada.</p>`;
      return;
    }

    container.innerHTML = state.editingImages
      .map(
        (url, idx) => `
      <div class="image-preview-item">
        <img src="${url}" alt="Foto ${idx + 1}" onerror="this.src='/assets/img/placeholder.svg'">
        <button type="button" class="image-preview-remove" data-idx="${idx}">&times;</button>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".image-preview-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        state.editingImages.splice(idx, 1);
        renderImagePreviews();
      });
    });
  }

  // Save Product Form
  document.getElementById("form-product")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("prod-id").value;
    const setor = document.getElementById("prod-setor").value;
    const categoria = document.getElementById("prod-categoria").value;
    const descricao = document.getElementById("prod-descricao").value.trim();
    const parseLocalPrice = (val) => {
      if (val === undefined || val === null || val === "") return 0;
      const clean = String(val).replace(/\s/g, "").replace(",", ".");
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    };

    const valor = parseLocalPrice(document.getElementById("prod-valor").value);
    let status = document.getElementById("prod-status").value;
    const informacoes = document.getElementById("prod-info").value.trim();

    const prodQtdRaw = document.getElementById("prod-quantidade")?.value;
    const quantidade = (prodQtdRaw !== undefined && prodQtdRaw !== null && prodQtdRaw !== "") ? Math.max(0, parseInt(prodQtdRaw) || 0) : 1;

    const emPromocao = document.getElementById("prod-promocao").checked;
    const precoPromocional = emPromocao ? parseLocalPrice(document.getElementById("prod-preco-promocional").value) : null;

    const { variacoes, tamanhos, cores } = getVariacoesFromForm();

    // Smart status adjustment if variations exist
    if (variacoes.length > 0) {
      const dispVars = variacoes.filter(v => !v.vendido && (v.quantidade === undefined || Number(v.quantidade) > 0)).length;
      if (dispVars === 0) {
        status = "vendido";
      } else if (status === "vendido" && dispVars > 0) {
        // If product was marked available in variations, make sure it is not accidentally blocked
        // unless explicitly set
      }
    } else {
      if (quantidade === 0) {
        status = "vendido";
      }
    }

    let urlData;
    if (state.editingImages.length === 1) {
      urlData = state.editingImages[0];
    } else if (state.editingImages.length > 1) {
      urlData = state.editingImages;
    } else {
      urlData = "/assets/img/placeholder.svg";
    }

    const payload = {
      descricao,
      valor,
      quantidade,
      status,
      informacoes,
      url: urlData,
      emPromocao,
      precoPromocional,
      variacoes,
      tamanhos,
      cores
    };

    try {
      let res;
      if (id) {
        // Edit
        res = await fetch(`/api/products/${setor}/${categoria}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        // Add
        res = await fetch(`/api/products/${setor}/${categoria}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success || data.product)) {
        closeModal("modal-product");
        loadProducts(setor, categoria);
        loadCategories(); // update badges
        notifySync();
      } else {
        alert(data.error || data.message || "Erro ao salvar produto.");
      }
    } catch (err) {
      alert("Erro ao conectar ao servidor.");
    }
  });

  // Load Trash Items
  async function loadTrash() {
    try {
      const res = await fetch(`/api/admin/trash?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const data = await res.json();
      state.trash = Array.isArray(data) ? data : [];
      renderTrash();
    } catch (err) {
      console.error("Erro ao carregar lixeira:", err);
    }
  }

  function renderTrash() {
    const grid = document.getElementById("grid-lixeira");
    const badge = document.getElementById("badge-trash-count");
    if (badge) badge.textContent = state.trash.length;

    if (!grid) return;

    if (state.trash.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">
          <i class="fas fa-trash-restore" style="font-size: 2.5rem; margin-bottom: 10px; color: #ccc;"></i>
          <p style="font-style: normal;">A lixeira está vazia.</p>
        </div>
      `;
      return;
    }

    const now = Date.now();
    grid.innerHTML = state.trash
      .map((item) => {
        const prod = item.product || {};
        let thumbUrl = Array.isArray(prod.url) ? prod.url[0] : prod.url;
        if (!thumbUrl || thumbUrl.trim() === "") thumbUrl = "/assets/img/placeholder.svg";

        const deletedTime = new Date(item.deletedAt).getTime();
        const daysPast = Math.floor((now - deletedTime) / (24 * 60 * 60 * 1000));
        const daysRemaining = Math.max(0, 30 - daysPast);

        return `
        <div class="product-admin-card" data-trash-id="${item.trashId}" style="border: 1px dashed var(--admin-danger);">
          <div style="background: rgba(220, 53, 69, 0.1); color: var(--admin-danger); font-size: 0.75rem; font-weight: bold; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px; text-align: center;">
            <i class="fas fa-clock"></i> Exclui em ${daysRemaining} dia(s)
          </div>
          <img src="${thumbUrl}" class="product-admin-thumb" alt="${prod.descricao || 'Produto'}" onerror="this.src='/assets/img/placeholder.svg'">
          <h4 class="product-admin-title">${prod.descricao || 'Produto'}</h4>
          <div style="font-size: 0.8rem; color: #666; margin-bottom: 4px;">Setor: ${item.setor} | Categoria: ${item.categoria}</div>
          <div class="product-admin-price">R$ ${Number(prod.valor || 0).toFixed(2)}</div>
          
          <div class="product-admin-actions" style="margin-top: 10px;">
            <button class="admin-btn admin-btn-success admin-btn-sm btn-restore-trash" data-trash-id="${item.trashId}">
              <i class="fas fa-undo"></i> Restaurar
            </button>
            <button class="admin-btn admin-btn-danger admin-btn-sm btn-delete-trash-perm" data-trash-id="${item.trashId}">
              <i class="fas fa-times-circle"></i> Excluir
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    // Restore listeners
    grid.querySelectorAll(".btn-restore-trash").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const trashId = btn.dataset.trashId;
        try {
          const res = await fetch(`/api/admin/trash/restore/${trashId}`, { method: "POST" });
          if (res.ok) {
            loadTrash();
            loadCategories();
            notifySync();
          } else {
            alert("Erro ao restaurar produto.");
          }
        } catch (e) {
          alert("Erro ao conectar.");
        }
      });
    });

    // Delete Perm listeners
    grid.querySelectorAll(".btn-delete-trash-perm").forEach((btn) => {
      btn.addEventListener("click", () => {
        const trashId = btn.dataset.trashId;
        const item = state.trash.find(t => t.trashId === trashId);
        state.pendingDelete = { isTrash: true, trashId };

        document.getElementById("confirm-delete-title").textContent = "Excluir Definitivamente";
        document.getElementById("confirm-delete-message").textContent = `Deseja apagar definitivamente "${item?.product?.descricao || 'este item'}"? Esta ação não pode ser desfeita.`;
        document.getElementById("btn-confirm-delete-action").innerHTML = `<i class="fas fa-times-circle"></i> Excluir Definitivamente`;
        openModal("modal-confirm-delete");
      });
    });
  }

  // Empty Trash button
  document.getElementById("btn-empty-trash")?.addEventListener("click", async () => {
    if (state.trash.length === 0) return alert("A lixeira já está vazia!");
    if (confirm("Tem certeza que deseja esvaziar a lixeira e apagar TODOS os itens definitivamente?")) {
      try {
        const res = await fetch("/api/admin/trash/empty", { method: "POST" });
        if (res.ok) {
          loadTrash();
          notifySync();
        }
      } catch (e) {
        alert("Erro ao esvaziar lixeira.");
      }
    }
  });

  // Helper to guess original URL
  function guessOriginalUrl(link) {
    if (link && link.urlOriginal && link.urlOriginal !== "manutencao.html") {
      return link.urlOriginal;
    }
    const t = ((link && link.titulo) || "").toLowerCase();
    if (t.includes("semijoia") || t.includes("semi-joia") || t.includes("styllus")) return "pages/semijoias/index.html";
    if (t.includes("lingerie") || t.includes("bella")) return "pages/lingeries/index.html";
    if (t.includes("boticário") || t.includes("boticario")) return "https://minhaloja.grupoboticario.com.br/carollalves";
    if (t.includes("mary kay") && t.includes("cadastro")) return "https://agreements.marykayintouch.com.br/r/c7oj5g1k";
    if (t.includes("mary kay")) return "https://loja.marykay.com.br/minha-vitrine?slug=carolalvesmk";
    if (t.includes("porta a porta") || t.includes("cancao nova")) return "https://catalogoportaaporta.cancaonova.com/gv-editora/cancao-nova/catalogo/";
    if (t.includes("shopee")) return "https://collshp.com/calummara";
    return "pages/semijoias/index.html";
  }

  function guessOriginalType(url) {
    if (!url) return "interno";
    if (url.startsWith("http://") || url.startsWith("https://")) return "externo";
    if (url === "manutencao.html") return "manutencao";
    return "interno";
  }

  // Load Home Links
  async function loadLinks() {
    try {
      const res = await fetch(`/api/links?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      const links = await res.json();
      state.links = links;
      renderLinksTable();
    } catch (err) {
      console.error("Erro ao carregar links:", err);
    }
  }

  function renderLinksTable() {
    const tbody = document.getElementById("links-tbody");
    if (!tbody) return;

    if (state.links.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum link cadastrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.links
      .map(
        (link, index) => {
          const isManutencao = link.tipo === "manutencao" || link.url === "manutencao.html";
          const isOculto = !!link.oculto;

          const typeBadgeHtml = isManutencao
            ? `<span class="badge-count" style="background: #e53935; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;"><i class="fas fa-tools"></i> Manutenção</span>`
            : `<span class="badge-count">${link.tipo || "externo"}</span>`;

          const visStatusHtml = isOculto
            ? `<span class="badge-count" style="background: #6c757d; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;"><i class="fas fa-eye-slash"></i> Oculto</span>`
            : `<span class="badge-count" style="background: #198754; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;"><i class="fas fa-eye"></i> Visível</span>`;

          const toggleVisBtnHtml = isOculto
            ? `<button class="admin-btn admin-btn-success admin-btn-sm btn-toggle-vis-link" data-index="${index}" title="Exibir página no catálogo" style="padding: 4px 8px; font-size: 0.78rem; margin-right: 4px;">
                <i class="fas fa-eye"></i> Exibir
               </button>`
            : `<button class="admin-btn admin-btn-secondary admin-btn-sm btn-toggle-vis-link" data-index="${index}" title="Ocultar página do catálogo" style="padding: 4px 8px; font-size: 0.78rem; margin-right: 4px; color: #856404; background: #fff3cd; border-color: #ffeeba;">
                <i class="fas fa-eye-slash"></i> Ocultar
               </button>`;

          const urlStyle = isManutencao ? "color: #e53935; font-weight: bold;" : "color: var(--admin-primary);";
          const rowStyle = isOculto ? 'style="background: rgba(0,0,0,0.02); opacity: 0.82;"' : '';

          const restoreBtnHtml = isManutencao
            ? `<button class="admin-btn admin-btn-success admin-btn-sm btn-quick-restore-table" data-index="${index}" title="Sair da manutenção e voltar para a página original" style="padding: 4px 8px; font-size: 0.78rem; margin-right: 4px;">
                <i class="fas fa-undo"></i> Restaurar
               </button>`
            : "";

          return `
            <tr ${rowStyle}>
              <td><strong>${index + 1}</strong></td>
              <td>
                <strong>${link.titulo}</strong>
                ${isOculto ? `<span style="font-size: 0.75rem; color: #6c757d; font-weight: normal; margin-left: 6px;">(Oculto no site)</span>` : ''}
              </td>
              <td>
                <a href="${link.url}" target="_blank" style="${urlStyle}">${link.url}</a>
                ${isManutencao && link.urlOriginal && link.urlOriginal !== 'manutencao.html' ? `<div style="font-size: 0.72rem; color: #888;">Original: ${link.urlOriginal}</div>` : ''}
              </td>
              <td style="text-align: center;">${typeBadgeHtml}</td>
              <td style="text-align: center;">${visStatusHtml}</td>
              <td style="text-align: center; white-space: nowrap;">
                ${toggleVisBtnHtml}
                ${restoreBtnHtml}
                <button class="admin-btn admin-btn-secondary admin-btn-sm btn-edit-link" data-index="${index}" title="Editar Link"><i class="fas fa-edit"></i></button>
                <button class="admin-btn admin-btn-danger admin-btn-sm btn-delete-link" data-index="${index}" title="Excluir Link"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `;
        }
      )
      .join("");

    // Toggle visibility button listener
    tbody.querySelectorAll(".btn-toggle-vis-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        const link = state.links[idx];
        link.oculto = !link.oculto;
        saveLinks();
      });
    });

    // Quick restore from table
    tbody.querySelectorAll(".btn-quick-restore-table").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        const link = state.links[idx];
        const origUrl = guessOriginalUrl(link);
        const origType = link.tipoOriginal || guessOriginalType(origUrl);
        
        link.url = origUrl;
        link.tipo = origType;
        link.urlOriginal = origUrl;
        link.tipoOriginal = origType;

        saveLinks();
      });
    });

    tbody.querySelectorAll(".btn-edit-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        const link = state.links[idx];
        document.getElementById("modal-link-title").textContent = "Editar Página / Link da Home";
        document.getElementById("link-id").value = idx;
        document.getElementById("link-titulo").value = link.titulo || "";
        document.getElementById("link-url").value = link.url || "";
        
        const origUrl = guessOriginalUrl(link);
        const origType = link.tipoOriginal || guessOriginalType(origUrl);
        document.getElementById("link-url-original").value = origUrl;
        document.getElementById("link-tipo-original").value = origType;

        const isManutencao = link.tipo === "manutencao" || link.url === "manutencao.html";
        document.getElementById("link-tipo").value = isManutencao ? "manutencao" : (link.tipo || guessOriginalType(link.url));
        
        const ocultoCheckbox = document.getElementById("link-oculto");
        if (ocultoCheckbox) {
          ocultoCheckbox.checked = !!link.oculto;
        }

        const presetSelect = document.getElementById("select-preset-pagina");
        if (presetSelect) {
          presetSelect.value = link.url || "";
        }

        updateOriginalButtonUi(origUrl);
        toggleMaintenanceLinkInfo();
        openModal("modal-link");
      });
    });

    tbody.querySelectorAll(".btn-delete-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        if (confirm("Excluir este link da página principal?")) {
          state.links.splice(idx, 1);
          saveLinks();
        }
      });
    });
  }

  function updateOriginalButtonUi(origUrl) {
    const btnQuickOrig = document.getElementById("btn-quick-original");
    const spanOrig = document.getElementById("span-original-btn-text");
    const bannerOrigLabel = document.getElementById("banner-orig-label");
    const currentUrl = document.getElementById("link-url")?.value.trim();

    if (origUrl && (currentUrl === "manutencao.html" || currentUrl !== origUrl)) {
      if (btnQuickOrig) {
        btnQuickOrig.style.display = "inline-flex";
        if (spanOrig) spanOrig.textContent = "Voltar p/ Original";
        btnQuickOrig.title = `Restaurar para: ${origUrl}`;
      }
      if (bannerOrigLabel) {
        bannerOrigLabel.textContent = origUrl;
      }
    } else {
      if (btnQuickOrig) btnQuickOrig.style.display = "none";
    }
  }

  function toggleMaintenanceLinkInfo() {
    const tipo = document.getElementById("link-tipo")?.value;
    const url = document.getElementById("link-url")?.value.trim();
    const infoDiv = document.getElementById("info-manutencao-link");
    if (!infoDiv) return;

    if (tipo === "manutencao" || url === "manutencao.html") {
      infoDiv.style.display = "block";
    } else {
      infoDiv.style.display = "none";
    }

    const origUrl = document.getElementById("link-url-original")?.value;
    updateOriginalButtonUi(origUrl);
  }

  // Link modal dynamic listeners
  const linkTipoSelect = document.getElementById("link-tipo");
  const linkUrlInput = document.getElementById("link-url");
  const selectPresetPagina = document.getElementById("select-preset-pagina");
  const btnQuickManutencao = document.getElementById("btn-quick-manutencao");
  const btnQuickOriginal = document.getElementById("btn-quick-original");
  const btnRevertFromBanner = document.getElementById("btn-revert-from-banner");

  function revertToOriginalUrl() {
    const origUrl = document.getElementById("link-url-original")?.value || "pages/semijoias/index.html";
    const origTipo = document.getElementById("link-tipo-original")?.value || guessOriginalType(origUrl);

    if (linkUrlInput) linkUrlInput.value = origUrl;
    if (linkTipoSelect) linkTipoSelect.value = origTipo;
    if (selectPresetPagina) selectPresetPagina.value = origUrl;

    toggleMaintenanceLinkInfo();
  }

  if (selectPresetPagina) {
    selectPresetPagina.addEventListener("change", (e) => {
      const selectedOpt = selectPresetPagina.selectedOptions[0];
      const val = selectedOpt?.value;
      if (val) {
        if (linkUrlInput) linkUrlInput.value = val;
        const targetTipo = selectedOpt.getAttribute("data-tipo") || guessOriginalType(val);
        if (linkTipoSelect) linkTipoSelect.value = targetTipo;

        const tituloInput = document.getElementById("link-titulo");
        const defaultTitle = selectedOpt.getAttribute("data-titulo");
        if (tituloInput && (!tituloInput.value || tituloInput.value.trim() === "") && defaultTitle) {
          tituloInput.value = defaultTitle;
        }

        toggleMaintenanceLinkInfo();
      }
    });
  }

  document.querySelectorAll(".btn-preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const targetUrl = chip.getAttribute("data-url");
      const targetTipo = chip.getAttribute("data-tipo") || guessOriginalType(targetUrl);
      const targetTitulo = chip.getAttribute("data-titulo");

      if (linkUrlInput) linkUrlInput.value = targetUrl;
      if (linkTipoSelect) linkTipoSelect.value = targetTipo;
      if (selectPresetPagina) selectPresetPagina.value = targetUrl;

      const tituloInput = document.getElementById("link-titulo");
      if (tituloInput && (!tituloInput.value || tituloInput.value.trim() === "") && targetTitulo) {
        tituloInput.value = targetTitulo;
      }

      toggleMaintenanceLinkInfo();
    });
  });

  if (btnQuickOriginal) {
    btnQuickOriginal.addEventListener("click", revertToOriginalUrl);
  }

  if (btnRevertFromBanner) {
    btnRevertFromBanner.addEventListener("click", revertToOriginalUrl);
  }

  if (linkTipoSelect) {
    linkTipoSelect.addEventListener("change", (e) => {
      if (e.target.value === "manutencao") {
        if (linkUrlInput) linkUrlInput.value = "manutencao.html";
        if (selectPresetPagina) selectPresetPagina.value = "manutencao.html";
      } else if (e.target.value === "interno" && linkUrlInput && linkUrlInput.value === "manutencao.html") {
        const origUrl = document.getElementById("link-url-original")?.value || "pages/semijoias/index.html";
        linkUrlInput.value = origUrl;
        if (selectPresetPagina) selectPresetPagina.value = origUrl;
      }
      toggleMaintenanceLinkInfo();
    });
  }

  if (linkUrlInput) {
    linkUrlInput.addEventListener("input", () => {
      if (selectPresetPagina) selectPresetPagina.value = linkUrlInput.value;
      toggleMaintenanceLinkInfo();
    });
  }

  if (btnQuickManutencao) {
    btnQuickManutencao.addEventListener("click", () => {
      if (linkTipoSelect) linkTipoSelect.value = "manutencao";
      if (linkUrlInput) linkUrlInput.value = "manutencao.html";
      if (selectPresetPagina) selectPresetPagina.value = "manutencao.html";
      toggleMaintenanceLinkInfo();
    });
  }

  document.getElementById("btn-add-link")?.addEventListener("click", () => {
    document.getElementById("modal-link-title").textContent = "Adicionar Nova Página / Link da Home";
    document.getElementById("form-link").reset();
    document.getElementById("link-id").value = "";
    document.getElementById("link-url-original").value = "";
    document.getElementById("link-tipo-original").value = "";
    const ocultoCheckbox = document.getElementById("link-oculto");
    if (ocultoCheckbox) ocultoCheckbox.checked = false;
    if (selectPresetPagina) selectPresetPagina.value = "";
    updateOriginalButtonUi("");
    toggleMaintenanceLinkInfo();
    openModal("modal-link");
  });

  document.getElementById("form-link")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("link-id").value;
    const titulo = document.getElementById("link-titulo").value.trim();
    let url = document.getElementById("link-url").value.trim();
    const tipo = document.getElementById("link-tipo").value;
    const oculto = !!document.getElementById("link-oculto")?.checked;
    let urlOriginal = document.getElementById("link-url-original")?.value || "";
    let tipoOriginal = document.getElementById("link-tipo-original")?.value || "";

    if (tipo === "manutencao" && !url) {
      url = "manutencao.html";
    }

    if (url !== "manutencao.html") {
      urlOriginal = url;
      tipoOriginal = tipo;
    } else if (!urlOriginal) {
      urlOriginal = guessOriginalUrl({ titulo });
      tipoOriginal = guessOriginalType(urlOriginal);
    }

    const linkObj = {
      id: id !== "" ? parseInt(id) + 1 : state.links.length + 1,
      titulo,
      url,
      tipo,
      oculto,
      urlOriginal,
      tipoOriginal
    };

    if (id !== "") {
      state.links[parseInt(id)] = linkObj;
    } else {
      state.links.push(linkObj);
    }

    saveLinks();
    closeModal("modal-link");
  });

  async function saveLinks() {
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.links)
      });
      if (res.ok) {
        renderLinksTable();
        notifySync();
      }
    } catch (err) {
      alert("Erro ao salvar alterações nos links.");
    }
  }

  // Load Gallery Images
  async function loadGalleryImages() {
    try {
      const res = await fetch("/api/images");
      state.images = await res.json();
      renderGallery();
    } catch (err) {
      console.error("Erro ao carregar banco de imagens:", err);
    }
  }

  function renderGallery() {
    const container = document.getElementById("gallery-grid");
    if (!container) return;

    if (state.images.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">Nenhuma imagem cadastrada.</p>`;
      return;
    }

    container.innerHTML = state.images
      .map(
        (imgUrl) => `
      <div style="border: 1px solid #eee; border-radius: 8px; overflow: hidden; background: white; text-align: center; padding: 6px;">
        <img src="${imgUrl}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 4px;" alt="Foto">
        <button class="admin-btn admin-btn-secondary admin-btn-sm btn-copy-img" data-url="${imgUrl}" style="margin-top: 6px; width: 100%; justify-content: center; font-size: 0.75rem;">
          <i class="fas fa-copy"></i> Copiar Path
        </button>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".btn-copy-img").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(btn.dataset.url);
        btn.innerHTML = `<i class="fas fa-check"></i> Copiado!`;
        setTimeout(() => {
          btn.innerHTML = `<i class="fas fa-copy"></i> Copiar Path`;
        }, 1500);
      });
    });
  }

  // Batch Image Upload
  const batchInput = document.getElementById("batch-upload-input");
  document.getElementById("btn-batch-upload")?.addEventListener("click", () => batchInput?.click());

  if (batchInput) {
    batchInput.addEventListener("change", async () => {
      if (!batchInput.files || batchInput.files.length === 0) return;

      const formData = new FormData();
      for (let file of batchInput.files) {
        formData.append("images", file);
      }

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          alert(`${data.urls.length} imagem(ns) enviada(s) com sucesso!`);
          loadGalleryImages();
        }
      } catch (err) {
        alert("Erro ao realizar upload.");
      } finally {
        batchInput.value = "";
      }
    });
  }

  // Choose from Gallery Picker Modal in Product Form
  document.getElementById("btn-choose-existing-img")?.addEventListener("click", async () => {
    await loadGalleryImages();
    const pickerGrid = document.getElementById("picker-grid");
    if (!pickerGrid) return;

    pickerGrid.innerHTML = state.images
      .map(
        (imgUrl) => `
      <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden; cursor: pointer;" class="picker-item" data-url="${imgUrl}">
        <img src="${imgUrl}" style="width: 100%; height: 90px; object-fit: cover;">
      </div>
    `
      )
      .join("");

    pickerGrid.querySelectorAll(".picker-item").forEach((item) => {
      item.addEventListener("click", () => {
        state.editingImages.push(item.dataset.url);
        renderImagePreviews();
        closeModal("modal-picker");
      });
    });

    openModal("modal-picker");
  });

  // Add Category Modal
  document.querySelectorAll(".btn-add-category").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = document.getElementById("form-category");
      form?.reset();
      const catSetor = document.getElementById("cat-setor");
      const targetSetor = btn.dataset.setor || (state.activeTab === "tab-lingeries" ? "lingeries" : "semijoias");
      if (catSetor) {
        catSetor.value = targetSetor;
      }
      openModal("modal-category");
    });
  });

  document.getElementById("cat-nome")?.addEventListener("input", (e) => {
    const slug = e.target.value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    const catIdInput = document.getElementById("cat-id");
    if (catIdInput) catIdInput.value = slug;
  });

  document.getElementById("form-category")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const setor = document.getElementById("cat-setor")?.value || "semijoias";
    const nome = document.getElementById("cat-nome")?.value.trim() || "";
    const id = document.getElementById("cat-id")?.value.trim() || "";

    if (!id && !nome) {
      alert("Por favor, preencha o nome da categoria.");
      return;
    }

    const submitBtn = document.getElementById("btn-submit-category");
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
    }

    try {
      const res = await fetch(`/api/categories/${setor}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, nome })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success || data.id)) {
        const createdCatId = data.id || id;
        closeModal("modal-category");
        await loadCategories();
        state.activeCategory[setor] = createdCatId;
        renderCategoryPills(setor);
        loadProducts(setor, createdCatId);
        notifySync();
      } else {
        alert(data.error || "Erro ao criar categoria.");
      }
    } catch (err) {
      console.error("Erro ao criar categoria:", err);
      alert("Erro na requisição ao servidor.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });

  // Backup and Restore Management
  const btnExportBackup = document.getElementById("btn-export-backup-full");
  const btnTriggerImport = document.getElementById("btn-trigger-import-backup");
  const inputImportFile = document.getElementById("input-import-backup-file");
  const backupStatusMsg = document.getElementById("backup-status-msg");

  if (btnExportBackup) {
    btnExportBackup.addEventListener("click", () => {
      window.location.href = `/api/admin/backup/export?_t=${Date.now()}`;
    });
  }

  if (btnTriggerImport && inputImportFile) {
    btnTriggerImport.addEventListener("click", () => {
      inputImportFile.click();
    });

    inputImportFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const confirmRestore = confirm("Atenção: A restauração do backup irá atualizar todas as categorias, produtos e links do catálogo com os dados do arquivo selecionado. Deseja continuar?");
      if (!confirmRestore) {
        inputImportFile.value = "";
        return;
      }

      try {
        if (backupStatusMsg) {
          backupStatusMsg.style.display = "block";
          backupStatusMsg.style.background = "#e3f2fd";
          backupStatusMsg.style.color = "#0d47a1";
          backupStatusMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando restauração do backup...';
        }

        const text = await file.text();
        const backupData = JSON.parse(text);

        const res = await fetch("/api/admin/backup/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(backupData)
        });

        const data = await res.json();
        if (res.ok) {
          if (backupStatusMsg) {
            backupStatusMsg.style.background = "#e8f5e9";
            backupStatusMsg.style.color = "#1b5e20";
            backupStatusMsg.innerHTML = '<i class="fas fa-check-circle"></i> ' + (data.message || "Backup restaurado com sucesso!");
          }
          await refreshAdminData();
          notifySync();
        } else {
          if (backupStatusMsg) {
            backupStatusMsg.style.background = "#ffebee";
            backupStatusMsg.style.color = "#b71c1c";
            backupStatusMsg.innerHTML = '<i class="fas fa-times-circle"></i> ' + (data.error || "Erro ao restaurar backup.");
          }
        }
      } catch (err) {
        if (backupStatusMsg) {
          backupStatusMsg.style.background = "#ffebee";
          backupStatusMsg.style.color = "#b71c1c";
          backupStatusMsg.innerHTML = '<i class="fas fa-times-circle"></i> O arquivo selecionado não é um arquivo de backup JSON válido.';
        }
      } finally {
        inputImportFile.value = "";
      }
    });
  }

  // Helper Modal Functions
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
  }

  // Password Visibility Toggle Handler
  function setupPasswordToggles() {
    document.querySelectorAll(".btn-toggle-password").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const targetId = btn.dataset.target;
        let input = targetId ? document.getElementById(targetId) : null;
        if (!input) {
          const wrapper = btn.closest(".password-input-wrapper");
          if (wrapper) {
            input = wrapper.querySelector("input");
          }
        }

        if (!input) return;

        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        // Update button icon and aria/title
        const icon = btn.querySelector("i");
        if (icon) {
          if (isPassword) {
            icon.className = "fas fa-eye-slash";
            btn.setAttribute("title", "Ocultar senha");
            btn.setAttribute("aria-label", "Ocultar senha");
          } else {
            icon.className = "fas fa-eye";
            btn.setAttribute("title", "Visualizar senha");
            btn.setAttribute("aria-label", "Visualizar senha");
          }
        }
      });
    });
  }

  function resetPasswordToggles(container = document) {
    if (!container) return;
    container.querySelectorAll(".password-input-wrapper").forEach((wrapper) => {
      const input = wrapper.querySelector("input");
      const btn = wrapper.querySelector(".btn-toggle-password");
      if (input) input.type = "password";
      if (btn) {
        const icon = btn.querySelector("i");
        if (icon) icon.className = "fas fa-eye";
        btn.setAttribute("title", "Visualizar senha");
        btn.setAttribute("aria-label", "Visualizar senha");
      }
    });
  }

  // Initialize password toggles
  setupPasswordToggles();

  // ==========================================
  // LOGS & SYSTEM DIAGNOSTICS MODULE
  // ==========================================
  let logsAutoRefreshInterval = null;

  async function fetchDiagnostics() {
    try {
      const res = await fetch("/api/admin/system-status");
      const data = await res.json();
      if (data.success) {
        const diagStorage = document.getElementById("diag-storage-type");
        const diagUptime = document.getElementById("diag-uptime");
        const diagInstance = document.getElementById("diag-instance-id");

        if (diagStorage) diagStorage.textContent = data.storageBackend || "Local JSON";
        if (diagUptime && data.diagnostics) {
          const uptimeSec = data.diagnostics.uptimeSeconds || 0;
          const mins = Math.floor(uptimeSec / 60);
          const hrs = Math.floor(mins / 60);
          const days = Math.floor(hrs / 24);
          if (days > 0) {
            diagUptime.textContent = `${days}d ${hrs % 24}h ${mins % 60}m`;
          } else if (hrs > 0) {
            diagUptime.textContent = `${hrs}h ${mins % 60}m`;
          } else {
            diagUptime.textContent = `${mins}m ${uptimeSec % 60}s`;
          }
        }
        if (diagInstance && data.diagnostics) {
          diagInstance.textContent = data.diagnostics.instanceId || "--";
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar diagnóstico:", e);
    }
  }

  async function fetchAndRenderLogs() {
    const container = document.getElementById("logs-container");
    if (!container) return;

    const level = document.getElementById("filter-log-level")?.value || "ALL";
    const category = document.getElementById("filter-log-category")?.value || "ALL";
    const search = document.getElementById("filter-log-search")?.value.trim() || "";

    const params = new URLSearchParams();
    if (level && level !== "ALL") params.append("level", level);
    if (category && category !== "ALL") params.append("category", category);
    if (search) params.append("search", search);
    params.append("limit", "200");

    try {
      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json();

      if (!data.success || !Array.isArray(data.logs) || data.logs.length === 0) {
        container.innerHTML = '<div style="color: #888; text-align: center; padding: 25px;">Nenhum registro de log encontrado para os filtros selecionados.</div>';
        return;
      }

      const rowsHtml = data.logs.map((log) => {
        let levelColor = "#0dcaf0"; // INFO
        let levelBg = "rgba(13, 202, 240, 0.15)";
        if (log.level === "AUDIT") {
          levelColor = "#ffc107";
          levelBg = "rgba(255, 193, 7, 0.18)";
        } else if (log.level === "WARN") {
          levelColor = "#fd7e14";
          levelBg = "rgba(253, 126, 20, 0.2)";
        } else if (log.level === "ERROR") {
          levelColor = "#dc3545";
          levelBg = "rgba(220, 53, 69, 0.25)";
        } else if (log.level === "DB") {
          levelColor = "#20c997";
          levelBg = "rgba(32, 201, 151, 0.18)";
        }

        const dateFormatted = new Date(log.timestamp).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3
        });

        const hasPayload = log.payload && Object.keys(log.payload).length > 0;
        const payloadStr = hasPayload ? JSON.stringify(log.payload, null, 2) : "";

        return `
          <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding: 8px 0; font-family: monospace; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
              <span style="color: #888; font-size: 0.78rem;">[${dateFormatted}]</span>
              <span style="color: ${levelColor}; background: ${levelBg}; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; text-transform: uppercase;">
                ${log.level}
              </span>
              <span style="color: #bbb; font-weight: 600; font-size: 0.76rem; background: rgba(255,255,255,0.05); padding: 2px 5px; border-radius: 3px;">
                ${log.category}
              </span>
              <span style="color: #e0e0e0; font-size: 0.82rem; flex: 1;">
                ${log.message}
              </span>
              ${hasPayload ? `<button class="btn-toggle-log-payload" style="background: none; border: 1px solid #444; color: #aaa; border-radius: 3px; font-size: 0.7rem; padding: 1px 5px; cursor: pointer;">Detalhes</button>` : ""}
            </div>
            ${hasPayload ? `<pre class="log-payload-box" style="display: none; margin: 4px 0 2px 20px; padding: 8px; background: rgba(0,0,0,0.4); border-radius: 4px; color: #a5d6a7; font-size: 0.75rem; overflow-x: auto;">${payloadStr}</pre>` : ""}
          </div>
        `;
      }).join("");

      container.innerHTML = rowsHtml;

      // Bind detail toggles
      container.querySelectorAll(".btn-toggle-log-payload").forEach((btn) => {
        btn.addEventListener("click", () => {
          const pre = btn.closest("div").parentElement.querySelector(".log-payload-box");
          if (pre) {
            const isHidden = pre.style.display === "none";
            pre.style.display = isHidden ? "block" : "none";
            btn.textContent = isHidden ? "Ocultar" : "Detalhes";
          }
        });
      });
    } catch (err) {
      container.innerHTML = '<div style="color: #e57373; text-align: center; padding: 20px;">Falha ao carregar registros de log.</div>';
    }
  }

  // Bind log controls
  document.getElementById("btn-refresh-logs")?.addEventListener("click", () => {
    fetchAndRenderLogs();
    fetchDiagnostics();
  });

  document.getElementById("btn-clear-logs")?.addEventListener("click", async () => {
    if (confirm("Deseja limpar todos os logs em memória?")) {
      try {
        await fetch("/api/admin/logs/clear", { method: "POST" });
        fetchAndRenderLogs();
      } catch (e) {
        alert("Erro ao limpar logs.");
      }
    }
  });

  document.getElementById("filter-log-level")?.addEventListener("change", fetchAndRenderLogs);
  document.getElementById("filter-log-category")?.addEventListener("change", fetchAndRenderLogs);
  document.getElementById("filter-log-search")?.addEventListener("input", () => {
    clearTimeout(window._logSearchTimeout);
    window._logSearchTimeout = setTimeout(fetchAndRenderLogs, 300);
  });

  // ==========================================
  // AUTO-RECOVERY & LOCAL BROWSER SNAPSHOT ENGINE
  // ==========================================
  const SNAPSHOT_KEY = "CAROL_ALVES_ADMIN_AUTO_BACKUP_V2";

  async function captureAndSaveBrowserSnapshot() {
    try {
      const res = await fetch(`/api/admin/backup/export?_t=${Date.now()}`);
      if (res.ok) {
        const fullBackup = await res.json();
        const totalItems = (
          Object.values(fullBackup.products?.semijoias || {}).reduce((acc, curr) => acc + (curr?.length || 0), 0) +
          Object.values(fullBackup.products?.lingeries || {}).reduce((acc, curr) => acc + (curr?.length || 0), 0)
        );

        // SAFETY: Do not overwrite an existing snapshot that has products if current server response has 0 products
        const rawExisting = localStorage.getItem(SNAPSHOT_KEY);
        if (rawExisting) {
          try {
            const existing = JSON.parse(rawExisting);
            if (existing && existing.totalProducts > 0 && totalItems === 0) {
              console.warn("[Auto-Recovery] Servidor retornou 0 produtos, preservando backup local seguro com", existing.totalProducts, "produtos.");
              return;
            }
          } catch (e) {}
        }

        if (totalItems > 0) {
          const snapshot = {
            timestamp: Date.now(),
            dateStr: new Date().toLocaleString("pt-BR"),
            totalProducts: totalItems,
            backupData: fullBackup
          };

          localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
          console.log("[Auto-Recovery] Snapshot local salvo com sucesso no navegador:", totalItems, "produtos.");
        }
      }
    } catch (err) {
      console.warn("[Auto-Recovery] Falha ao capturar snapshot local:", err);
    }
  }

  async function checkAndPromptBrowserRecovery() {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return;

    try {
      const snapshot = JSON.parse(raw);
      if (!snapshot || !snapshot.backupData || !snapshot.totalProducts) return;

      // Count total products currently loaded on server
      const totalServerProds = (
        Object.values(state.categories?.semijoias || []).reduce((acc, c) => acc + (c.qtdItens || 0), 0) +
        Object.values(state.categories?.lingeries || []).reduce((acc, c) => acc + (c.qtdItens || 0), 0)
      );

      // If browser backup has MORE products than server or server was unexpectedly reset to 0
      if (snapshot.totalProducts > totalServerProds && totalServerProds === 0) {
        const banner = document.getElementById("reset-recovery-banner");
        const countSpan = document.getElementById("recovery-prods-count");
        const dateSpan = document.getElementById("recovery-date");

        if (banner && countSpan && dateSpan) {
          countSpan.textContent = snapshot.totalProducts;
          dateSpan.textContent = snapshot.dateStr || "recente";
          banner.style.display = "block";
        }
      }
    } catch (e) {
      console.warn("[Auto-Recovery] Erro ao verificar snapshot:", e);
    }
  }

  // Restore snapshot from browser
  document.getElementById("btn-apply-browser-recovery")?.addEventListener("click", async () => {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      alert("Nenhum backup local encontrado no navegador.");
      return;
    }

    try {
      const snapshot = JSON.parse(raw);
      const res = await fetch("/api/admin/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot.backupData)
      });

      if (res.ok) {
        alert("Todos os dados do seu backup local foram restaurados com sucesso no catálogo!");
        document.getElementById("reset-recovery-banner").style.display = "none";
        await refreshAdminData();
        notifySync();
      } else {
        alert("Falha ao restaurar dados no servidor.");
      }
    } catch (err) {
      alert("Erro ao processar restauração do navegador.");
    }
  });

  document.getElementById("btn-dismiss-recovery")?.addEventListener("click", () => {
    const banner = document.getElementById("reset-recovery-banner");
    if (banner) banner.style.display = "none";
  });

  document.getElementById("btn-save-browser-snapshot")?.addEventListener("click", async () => {
    await captureAndSaveBrowserSnapshot();
    alert("Snapshot do catálogo salvo com sucesso na memória persistente do seu navegador!");
  });

  document.getElementById("btn-force-sync-db")?.addEventListener("click", async () => {
    await refreshAdminData();
    await fetchDiagnostics();
    alert("Sincronização geral concluída!");
  });

  // Automatically take a browser snapshot whenever admin operations complete
  const originalNotifySync = notifySync;
  notifySync = function() {
    originalNotifySync();
    setTimeout(captureAndSaveBrowserSnapshot, 1000);
  };

  // Manage tab activation for logs and diagnostics
  document.querySelectorAll(".admin-tab-btn").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const tabId = tabBtn.dataset.tab;
      if (tabId === "tab-logs") {
        fetchAndRenderLogs();
        fetchDiagnostics();
        if (!logsAutoRefreshInterval) {
          logsAutoRefreshInterval = setInterval(() => {
            const toggle = document.getElementById("toggle-auto-refresh-logs");
            if (toggle && toggle.checked) {
              fetchAndRenderLogs();
            }
          }, 5000);
        }
      } else {
        if (logsAutoRefreshInterval) {
          clearInterval(logsAutoRefreshInterval);
          logsAutoRefreshInterval = null;
        }
      }
      if (tabId === "tab-backup") {
        fetchDiagnostics();
      }
    });
  });

  // Initial check on load
  setTimeout(() => {
    fetchDiagnostics();
    checkAndPromptBrowserRecovery();
  }, 1200);

  // Bind close buttons
  document.querySelectorAll(".modal-close-btn, .modal-close-btn-action").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const overlay = btn.closest(".admin-modal-overlay");
      if (overlay) {
        overlay.classList.remove("active");
        resetPasswordToggles(overlay);
      }
    });
  });

  document.querySelectorAll(".admin-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
        resetPasswordToggles(overlay);
      }
    });
  });
});
