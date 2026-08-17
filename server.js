import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import {
  seedDatabaseFromLocalFiles,
  getDbCategoryNames,
  saveDbCategoryNames,
  getDbHomeLinks,
  saveDbHomeLinks,
  getDbAdminConfig,
  saveDbAdminConfig,
  getDbProducts,
  saveDbCategoryProducts,
  getAllDbProducts,
  getDbTrash,
  saveDbTrash,
  saveDbUploadedImage,
  getDbUploadedImage,
  getAllDbUploadedImages,
  defaultCategoryNames
} from './src/db/repository.ts';
import { logEvent, getLogs, clearLogs } from './src/lib/logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global CORS and No-Cache middleware to ensure immediate sync across all devices and browsers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // Prevent caching of APIs, dynamic data, HTML pages, JSON and JS scripts
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/data/') ||
    req.path.endsWith('.html') ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.json') ||
    req.path === '/'
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// Audit logger
const autoCommitAndPush = (message = 'Update from admin panel') => {
  console.log(`[Local Storage Sync] ${new Date().toISOString()} - ${message}`);
};

// Ensure upload directory exists for temporary caching if needed
const uploadDir = path.join(__dirname, 'assets', 'img', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.avif', '.heic', '.heif'];
    if (file.mimetype?.startsWith('image/') || validExts.includes(ext) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
  }
});

// Resolve Category Page URL
const getCategoryUrl = (setor, catKey) => {
  if (setor === 'semijoias' && (catKey === 'braceletes' || catKey === 'bracelete')) {
    if (fs.existsSync(path.join(__dirname, 'pages', 'semijoias', 'bracelete', 'bracelete.html'))) {
      return '/pages/semijoias/bracelete/bracelete.html';
    }
  }
  if (setor === 'lingeries' && (catKey === 'conjunto' || catKey === 'conjuntos')) {
    if (fs.existsSync(path.join(__dirname, 'pages', 'lingeries', 'conjunto', 'conjuntos.html'))) {
      return '/pages/lingeries/conjunto/conjuntos.html';
    }
  }

  const stdUrl = `/pages/${setor}/${catKey}/${catKey}.html`;
  return stdUrl;
};

// API: Admin Authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, pin } = req.body;
    const currentConfig = await getDbAdminConfig();

    const inputEmail = (email || '').toLowerCase().trim();
    const inputPin = (pin || '').trim();

    if (!inputEmail) {
      return res.status(400).json({ success: false, message: 'Por favor, informe seu e-mail!' });
    }

    if (inputEmail !== currentConfig.email) {
      return res.status(401).json({ success: false, message: 'E-mail de administrador incorreto ou não cadastrado!' });
    }

    if (inputPin !== currentConfig.pin) {
      return res.status(401).json({ success: false, message: 'PIN de acesso incorreto!' });
    }

    res.json({ success: true, message: 'Autenticado com sucesso!', user: { email: currentConfig.email } });
  } catch (err) {
    console.error('Erro no login admin:', err);
    res.status(500).json({ success: false, message: 'Erro no servidor durante autenticação.' });
  }
});

// API: Public Store Config (for WhatsApp cart, store name, etc.)
app.get('/api/public-config', async (req, res) => {
  try {
    const currentConfig = await getDbAdminConfig();
    res.json({
      success: true,
      storeName: 'Carol Alves',
      whatsapp: currentConfig.whatsapp || ''
    });
  } catch (err) {
    res.json({ success: true, storeName: 'Carol Alves', whatsapp: '' });
  }
});

// API: Get Admin Info
app.get('/api/admin/info', async (req, res) => {
  try {
    const currentConfig = await getDbAdminConfig();
    res.json({
      success: true,
      email: currentConfig.email,
      whatsapp: currentConfig.whatsapp || ''
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao carregar dados do admin.' });
  }
});

app.post('/api/admin/change-pin', async (req, res) => {
  try {
    const { currentPin, newEmail, newPin, whatsapp } = req.body;
    const currentConfig = await getDbAdminConfig();

    if (currentPin !== currentConfig.pin) {
      return res.status(401).json({ success: false, message: 'PIN atual incorreto!' });
    }

    let updatedEmail = currentConfig.email;
    if (newEmail && newEmail.trim().length > 0) {
      const cleanEmail = newEmail.trim().toLowerCase();
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({ success: false, message: 'Formato de e-mail inválido!' });
      }
      updatedEmail = cleanEmail;
    }

    let updatedPin = currentConfig.pin;
    if (newPin && newPin.trim().length > 0) {
      if (newPin.trim().length < 4) {
        return res.status(400).json({ success: false, message: 'O novo PIN deve ter pelo menos 4 dígitos!' });
      }
      updatedPin = newPin.trim();
    }

    let updatedWhatsapp = currentConfig.whatsapp || '';
    if (whatsapp !== undefined) {
      // Clean up phone number, keep only numbers or standard format
      updatedWhatsapp = String(whatsapp).replace(/\D/g, '').trim();
    }

    await saveDbAdminConfig({ email: updatedEmail, pin: updatedPin, whatsapp: updatedWhatsapp });
    autoCommitAndPush(`Alteração de credenciais/WhatsApp do admin (${updatedEmail}) no PostgreSQL`);

    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso!',
      user: { email: updatedEmail, whatsapp: updatedWhatsapp }
    });
  } catch (err) {
    console.error('Erro na alteração de credenciais:', err);
    res.status(500).json({ success: false, message: 'Erro ao alterar credenciais.' });
  }
});

// API: Home Links
app.get('/api/links', async (req, res) => {
  try {
    const links = await getDbHomeLinks();
    res.json(links);
  } catch (e) {
    console.error("Erro lendo links:", e);
    res.status(500).json({ error: "Erro ao carregar links da home." });
  }
});

app.post('/api/links', async (req, res) => {
  try {
    const links = req.body;
    if (!Array.isArray(links)) {
      return res.status(400).json({ error: "Formato inválido. Esperado um array de links." });
    }
    await saveDbHomeLinks(links);
    autoCommitAndPush('Atualização de links da página inicial salva no PostgreSQL');
    res.json({ success: true, links });
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar links da home." });
  }
});

// Helper to list categories in a sector
async function listCategoriesForSector(setor, includeEmpty = false) {
  const catNames = await getDbCategoryNames();
  const setorNames = catNames[setor] || {};
  const categories = [];

  const catKeys = Object.keys(setorNames);

  for (const catKey of catKeys) {
    const items = await getDbProducts(setor, catKey);
    const itemCount = items.length;
    if (includeEmpty || itemCount > 0) {
      const label = setorNames[catKey] || catKey.charAt(0).toUpperCase() + catKey.slice(1);
      categories.push({
        id: catKey,
        nome: label,
        qtdItens: itemCount,
        url: getCategoryUrl(setor, catKey)
      });
    }
  }

  return categories;
}

// API: List Categories for specific sector (used by public catalog)
app.get('/api/categories/:setor', async (req, res) => {
  const { setor } = req.params;
  if (!['lingeries', 'semijoias'].includes(setor)) {
    return res.status(400).json({ error: "Setor inválido." });
  }
  const includeEmpty = req.query.includeEmpty === 'true';
  const categories = await listCategoriesForSector(setor, includeEmpty);
  res.json(categories);
});

// API: List Categories and Sectors (used by admin or general query)
app.get('/api/categories', async (req, res) => {
  const sectors = ['lingeries', 'semijoias'];
  const result = {};
  const isPublic = req.query.public === 'true' || req.query.hideEmpty === 'true';
  const includeEmpty = req.query.includeEmpty !== undefined ? req.query.includeEmpty === 'true' : !isPublic;

  for (const setor of sectors) {
    result[setor] = await listCategoriesForSector(setor, includeEmpty);
  }

  res.json(result);
});

// API: Create new Category
app.post('/api/categories/:setor', async (req, res) => {
  const { setor } = req.params;
  const { id, nome } = req.body;

  if (!['lingeries', 'semijoias'].includes(setor)) {
    return res.status(400).json({ error: "Setor inválido." });
  }

  const rawId = id || (nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
  const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) {
    return res.status(400).json({ error: "ID da categoria é obrigatório." });
  }

  // Register display label in PostgreSQL
  const catNames = await getDbCategoryNames();
  if (!catNames[setor]) catNames[setor] = {};
  const displayName = (nome && nome.trim()) ? nome.trim() : cleanId;
  catNames[setor][cleanId] = displayName;
  await saveDbCategoryNames(catNames);

  // Initialize empty products list in PostgreSQL
  await saveDbCategoryProducts(setor, cleanId, []);

  // Generate category HTML page file
  const pageDir = path.join(__dirname, 'pages', setor, cleanId);
  const pageHtmlPath = path.join(pageDir, `${cleanId}.html`);
  if (!fs.existsSync(pageHtmlPath)) {
    fs.mkdirSync(pageDir, { recursive: true });
    const pageContent = `<!doctype html>
<html lang="PT-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/css/style.css" />
    <title>${displayName}</title>
  </head>
  <body>
    <div class="div-principal">
      <h1>${displayName}</h1>
    </div>
    <div class="div-main">
      <h1>Nossos Produtos</h1>
      <div
        id="container-produtos"
        class="grid-produtos"
        data-setor="${setor}"
        data-categoria="${cleanId}"
      ></div>
      <div class="div-2">
        <a href="/pages/${setor}/index.html" class="link-retornar-anterior">Retornar à página anterior</a>
      </div>
    </div>
    <footer>
      <div class="div-footer">
        <p>
          Copyright © 2026 Revendedora Carol Alves. Todos os direitos
          reservados. | <a href="/pages/admin/index.html" class="link-admin-footer" style="color: #5c1838; font-weight: bold; text-decoration: underline;">Painel Administrativo</a>
        </p>
      </div>
    </footer>
    <div id="zoom-modal" class="zoom-modal">
      <span class="zoom-fechar">&times;</span>
      <button class="zoom-seta zoom-prev" id="zoom-prev">&#10094;</button>
      <img
        class="zoom-conteudo"
        id="img-ampliada"
        alt="Imagem ampliada do produto"
      />
      <button class="zoom-seta zoom-next" id="zoom-next">&#10095;</button>
    </div>
    <script src="/js/main.js"></script>
  </body>
</html>
`;
    fs.writeFileSync(pageHtmlPath, pageContent, 'utf-8');
  }

  const categoryUrl = getCategoryUrl(setor, cleanId);
  autoCommitAndPush(`Nova categoria cadastrada (${setor}/${cleanId}: ${displayName})`);
  res.json({ success: true, id: cleanId, nome: displayName, url: categoryUrl });
});

// API: Get products in category
app.get('/api/products/:setor/:categoria', async (req, res) => {
  const { setor, categoria } = req.params;
  try {
    const products = await getDbProducts(setor, categoria);
    res.json(products);
  } catch (error) {
    console.error(`Erro ao buscar produtos de ${setor}/${categoria}:`, error);
    res.status(500).json({ error: "Erro ao ler produtos." });
  }
});

// Helper to parse numerical prices
const parseNumericPrice = (val) => {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// API: Create product
app.post('/api/products/:setor/:categoria', async (req, res) => {
  const { setor, categoria } = req.params;
  try {
    const products = await getDbProducts(setor, categoria);
    const newProduct = req.body;

    if (!newProduct.id) {
      const maxId = products.reduce((max, p) => (typeof p.id === 'number' && p.id > max ? p.id : max), 0);
      newProduct.id = maxId + 1;
    }

    if (newProduct.valor !== undefined) {
      newProduct.valor = parseNumericPrice(newProduct.valor) || 0;
    }
    if (newProduct.precoPromocional !== undefined) {
      newProduct.precoPromocional = parseNumericPrice(newProduct.precoPromocional);
    }
    if (!newProduct.status) {
      newProduct.status = 'disponivel';
    }

    products.unshift(newProduct);
    await saveDbCategoryProducts(setor, categoria, products);

    autoCommitAndPush(`Novo produto salvo no PostgreSQL (${setor}/${categoria}: ${newProduct.descricao || newProduct.id})`);
    res.status(201).json({ success: true, product: newProduct });
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ error: error.message || "Erro ao salvar o produto." });
  }
});

// API: Update product
app.put('/api/products/:setor/:categoria/:id', async (req, res) => {
  const { setor, categoria, id } = req.params;
  try {
    let products = await getDbProducts(setor, categoria);
    const prodIndex = products.findIndex(p => String(p.id) === String(id));

    if (prodIndex === -1) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    const updatedData = req.body;
    if (updatedData.valor !== undefined) {
      updatedData.valor = parseNumericPrice(updatedData.valor) || 0;
    }
    if (updatedData.precoPromocional !== undefined) {
      updatedData.precoPromocional = parseNumericPrice(updatedData.precoPromocional);
    }

    products[prodIndex] = {
      ...products[prodIndex],
      ...updatedData,
      id: products[prodIndex].id
    };

    await saveDbCategoryProducts(setor, categoria, products);
    autoCommitAndPush(`Produto atualizado no PostgreSQL (${setor}/${categoria} ID: ${id})`);
    res.json({ success: true, product: products[prodIndex] });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: error.message || "Erro ao atualizar produto." });
  }
});

// Trash helper
const purgeOldTrash = async () => {
  try {
    const trash = await getDbTrash();
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const validItems = trash.filter(item => {
      const deletedAt = new Date(item.deletedAt).getTime();
      return (now - deletedAt) < thirtyDaysMs;
    });

    if (validItems.length !== trash.length) {
      await saveDbTrash(validItems);
      autoCommitAndPush('Limpeza automatica da lixeira no PostgreSQL');
    }
    return validItems;
  } catch (e) {
    console.error('Erro ao purgar lixeira:', e);
    return [];
  }
};

// API: Delete product (Move to Trash)
app.delete('/api/products/:setor/:categoria/:id', async (req, res) => {
  const { setor, categoria, id } = req.params;
  try {
    let products = await getDbProducts(setor, categoria);
    const targetProduct = products.find(p => String(p.id) === String(id));

    if (!targetProduct) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    const filtered = products.filter(p => String(p.id) !== String(id));
    await saveDbCategoryProducts(setor, categoria, filtered);

    // Move to trash
    const trash = await purgeOldTrash();
    const trashItem = {
      trashId: "trash_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      id: targetProduct.id,
      setor: setor,
      categoria: categoria,
      deletedAt: new Date().toISOString(),
      product: targetProduct
    };
    trash.unshift(trashItem);
    await saveDbTrash(trash);

    autoCommitAndPush(`Produto movido para a lixeira no PostgreSQL (${setor}/${categoria}: ID ${id})`);
    res.json({ success: true, message: "Produto movido para a Lixeira com sucesso." });
  } catch (error) {
    console.error("Erro ao mover produto para lixeira:", error);
    res.status(500).json({ error: "Erro ao excluir produto." });
  }
});

// API: Batch Delete products (Move multiple items to Trash)
app.post('/api/products/:setor/:categoria/batch-delete', async (req, res) => {
  const { setor, categoria } = req.params;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Nenhum produto selecionado para exclusão." });
  }

  try {
    let products = await getDbProducts(setor, categoria);
    const strIds = ids.map(id => String(id));

    const targetProducts = products.filter(p => strIds.includes(String(p.id)));
    if (targetProducts.length === 0) {
      return res.status(404).json({ error: "Nenhum produto correspondente foi encontrado." });
    }

    const remainingProducts = products.filter(p => !strIds.includes(String(p.id)));
    await saveDbCategoryProducts(setor, categoria, remainingProducts);

    // Move all target products to trash
    const trash = await purgeOldTrash();
    targetProducts.forEach(prod => {
      trash.unshift({
        trashId: "trash_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        id: prod.id,
        setor: setor,
        categoria: categoria,
        deletedAt: new Date().toISOString(),
        product: prod
      });
    });
    await saveDbTrash(trash);

    autoCommitAndPush(`${targetProducts.length} produtos movidos para a lixeira no PostgreSQL`);
    res.json({ success: true, count: targetProducts.length, message: `${targetProducts.length} produto(s) movido(s) para a Lixeira.` });
  } catch (error) {
    console.error("Erro na exclusão em lote:", error);
    res.status(500).json({ error: "Erro ao excluir produtos em lote." });
  }
});

// API: Get Trash items
app.get('/api/admin/trash', async (req, res) => {
  try {
    const items = await purgeOldTrash();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "Erro ao carregar lixeira." });
  }
});

// API: Restore Trash item
app.post('/api/admin/trash/restore/:trashId', async (req, res) => {
  const { trashId } = req.params;
  try {
    let trash = await purgeOldTrash();
    const itemIndex = trash.findIndex(t => String(t.trashId) === String(trashId));

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item não encontrado na lixeira." });
    }

    const trashItem = trash[itemIndex];
    const { setor, categoria, product } = trashItem;

    let products = await getDbProducts(setor, categoria);

    if (!products.some(p => String(p.id) === String(product.id))) {
      products.unshift(product);
      await saveDbCategoryProducts(setor, categoria, products);
    }

    trash.splice(itemIndex, 1);
    await saveDbTrash(trash);

    autoCommitAndPush(`Produto restaurado da lixeira no PostgreSQL (${setor}/${categoria}: ID ${product.id})`);
    res.json({ success: true, message: "Produto restaurado com sucesso!" });
  } catch (e) {
    console.error("Erro ao restaurar produto:", e);
    res.status(500).json({ error: "Erro ao restaurar produto." });
  }
});

// API: Permanently Delete Trash item
app.delete('/api/admin/trash/:trashId', async (req, res) => {
  const { trashId } = req.params;
  try {
    let trash = await purgeOldTrash();
    const filtered = trash.filter(t => String(t.trashId) !== String(trashId));
    await saveDbTrash(filtered);

    autoCommitAndPush(`Produto excluído definitivamente da lixeira no PostgreSQL (ID: ${trashId})`);
    res.json({ success: true, message: "Produto excluído definitivamente." });
  } catch (e) {
    res.status(500).json({ error: "Erro ao excluir item da lixeira." });
  }
});

// API: Empty Trash
app.post('/api/admin/trash/empty', async (req, res) => {
  try {
    await saveDbTrash([]);
    autoCommitAndPush("Lixeira esvaziada no PostgreSQL");
    res.json({ success: true, message: "Lixeira esvaziada com sucesso." });
  } catch (e) {
    res.status(500).json({ error: "Erro ao esvaziar lixeira." });
  }
});

// API: Upload image endpoint (persists to disk and PostgreSQL uploaded_images table)
app.post('/api/upload', (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('[Upload Multer Error]:', err.message);
      return res.status(400).json({ success: false, error: err.message || 'Falha no processamento do arquivo de imagem.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
    }

    const uploadedFiles = [];
    for (const f of req.files) {
      const ext = path.extname(f.originalname || '') || '.jpg';
      const cleanBase = path.basename(f.originalname || 'imagem', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${Date.now()}_${cleanBase}${ext}`;
      const base64Data = f.buffer ? f.buffer.toString('base64') : '';

      try {
        await saveDbUploadedImage({
          filename: filename,
          originalName: f.originalname || filename,
          mimeType: f.mimetype || 'image/jpeg',
          data: base64Data,
          size: f.size || (f.buffer ? f.buffer.length : 0)
        });
      } catch (saveErr) {
        console.warn(`[Upload Notice] Falha secundária ao persistir ${filename}:`, saveErr);
      }

      uploadedFiles.push({
        url: `/assets/img/uploads/${filename}`,
        filename: filename,
        originalName: f.originalname,
        size: f.size
      });
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'Não foi possível processar a imagem enviada.' });
    }

    autoCommitAndPush(`Upload de ${uploadedFiles.length} imagem(ns) concluído com sucesso`);
    res.json({
      success: true,
      url: uploadedFiles[0].url,
      urls: uploadedFiles.map(u => u.url),
      files: uploadedFiles
    });
  } catch (err) {
    console.error('[Upload Handler Error]:', err);
    res.status(500).json({ success: false, error: 'Erro inesperado ao processar o upload da imagem.' });
  }
});

// API: Full System Backup Export
app.get('/api/admin/backup/export', async (req, res) => {
  try {
    const adminConfig = await getDbAdminConfig();
    const categoryNames = await getDbCategoryNames();
    const homeLinks = await getDbHomeLinks();
    const trash = await getDbTrash();

    const backupData = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      storage: 'postgresql',
      adminConfig: {
        email: adminConfig.email,
        whatsapp: adminConfig.whatsapp || ''
      },
      categoryNames,
      homeLinks,
      trash,
      products: {
        semijoias: {},
        lingeries: {}
      }
    };

    const sectors = ['semijoias', 'lingeries'];
    for (const setor of sectors) {
      const setorCats = categoryNames[setor] || {};
      for (const catKey of Object.keys(setorCats)) {
        backupData.products[setor][catKey] = await getDbProducts(setor, catKey);
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup_catalogo_carolalves_${new Date().toISOString().slice(0, 10)}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error("Erro ao gerar backup completo:", error);
    res.status(500).json({ error: "Erro ao gerar backup dos dados." });
  }
});

// API: Full System Backup Import
app.post('/api/admin/backup/import', async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: "Arquivo de backup inválido." });
    }

    if (backup.categoryNames) {
      await saveDbCategoryNames(backup.categoryNames);
    }

    if (backup.adminConfig && backup.adminConfig.email && backup.adminConfig.pin) {
      await saveDbAdminConfig(backup.adminConfig);
    }

    if (Array.isArray(backup.homeLinks)) {
      await saveDbHomeLinks(backup.homeLinks);
    }

    if (Array.isArray(backup.trash)) {
      await saveDbTrash(backup.trash);
    }

    if (backup.products && typeof backup.products === 'object') {
      for (const setor of ['semijoias', 'lingeries']) {
        if (backup.products[setor] && typeof backup.products[setor] === 'object') {
          for (const catKey of Object.keys(backup.products[setor])) {
            const items = backup.products[setor][catKey];
            if (Array.isArray(items)) {
              await saveDbCategoryProducts(setor, catKey, items);

              // Ensure category HTML page exists
              const pageDir = path.join(__dirname, 'pages', setor, catKey);
              const pageHtmlPath = path.join(pageDir, `${catKey}.html`);
              if (!fs.existsSync(pageHtmlPath)) {
                fs.mkdirSync(pageDir, { recursive: true });
                const catNames = await getDbCategoryNames();
                const displayName = catNames[setor]?.[catKey] || catKey;
                const pageContent = `<!doctype html>
<html lang="PT-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/css/style.css" />
    <title>${displayName}</title>
  </head>
  <body>
    <div class="div-principal">
      <h1>${displayName}</h1>
    </div>
    <div class="div-main">
      <h1>Nossos Produtos</h1>
      <div id="container-produtos" class="grid-produtos" data-setor="${setor}" data-categoria="${catKey}"></div>
      <div class="div-2">
        <a href="../index.html">Retornar à página anterior</a>
      </div>
    </div>
    <footer>
      <div class="div-footer">
        <p>Copyright © 2026 Revendedora Carol Alves. Todos os direitos reservados.</p>
      </div>
    </footer>
    <div id="zoom-modal" class="zoom-modal">
      <span class="zoom-fechar">&times;</span>
      <button class="zoom-seta zoom-prev" id="zoom-prev">&#10094;</button>
      <img class="zoom-conteudo" id="img-ampliada" alt="Imagem ampliada do produto" />
      <button class="zoom-seta zoom-next" id="zoom-next">&#10095;</button>
    </div>
    <script src="/js/main.js"></script>
  </body>
</html>`;
                fs.writeFileSync(pageHtmlPath, pageContent, 'utf-8');
              }
            }
          }
        }
      }
    }

    autoCommitAndPush("Backup completo restaurado com sucesso no PostgreSQL");
    logEvent('AUDIT', 'ADMIN_ACTION', 'Backup completo restaurado com sucesso no sistema');
    res.json({ success: true, message: "Backup restaurado com sucesso! Todos os dados foram atualizados no PostgreSQL." });
  } catch (error) {
    logEvent('ERROR', 'ADMIN_ACTION', 'Erro ao importar backup', { error: error.message || String(error) });
    console.error("Erro ao importar backup:", error);
    res.status(500).json({ error: "Erro ao processar restauração do backup." });
  }
});

// API: System Logs & Audit Trail
app.get('/api/admin/logs', async (req, res) => {
  try {
    const { level, category, search, limit } = req.query;
    const data = getLogs({
      level: level ? String(level) : undefined,
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 150
    });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar logs do sistema.' });
  }
});

// API: Clear Logs
app.post('/api/admin/logs/clear', async (req, res) => {
  try {
    clearLogs();
    res.json({ success: true, message: 'Logs em memória limpos com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao limpar logs.' });
  }
});

// API: System Diagnostics & Health Status
const getSystemStatusHandler = async (req, res) => {
  try {
    const adminConfig = await getDbAdminConfig();
    const catNames = await getDbCategoryNames();
    const allProds = await getAllDbProducts();
    const trash = await getDbTrash();
    const uploadedImgs = await getAllDbUploadedImages();
    const { diagnostics } = getLogs();

    res.json({
      success: true,
      status: 'healthy',
      storageBackend: 'PostgreSQL Database (Cloud SQL)',
      totalProducts: allProds.length,
      semijoiasProducts: allProds.filter(p => p.setor === 'semijoias').length,
      lingeriesProducts: allProds.filter(p => p.setor === 'lingeries').length,
      trashCount: trash.length,
      uploadedImagesCount: uploadedImgs.length,
      diagnostics
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


app.get('/api/admin/system-status', getSystemStatusHandler);
app.get('/api/status', getSystemStatusHandler);

// API: List existing images directly from local storage
app.get('/api/images', async (req, res) => {
  try {
    const dbUploads = await getAllDbUploadedImages();
    const imageList = dbUploads.map(img => {
      let relPath = `/assets/img/uploads/${img.filename}`;
      if (img.originalName && img.originalName.startsWith('/assets/img/')) {
        relPath = img.originalName;
      }
      return {
        path: relPath,
        name: img.filename,
        category: path.dirname(relPath).replace('/assets/img/', '') || 'uploads',
        size: img.size,
        mtime: img.createdAt
      };
    });

    res.json(imageList);
  } catch (error) {
    console.error("Erro ao listar imagens:", error);
    res.status(500).json({ error: "Erro ao listar imagens." });
  }
});

// Dynamic Asset Route: Serves images from disk OR directly from storage/database
app.get('/assets/img/*', async (req, res, next) => {
  const reqPath = req.path;
  const filename = path.basename(reqPath);
  const diskPath = path.join(__dirname, reqPath);

  // 1. If on disk, serve directly
  if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(diskPath);
  }

  // 1b. Check singular/plural alternative paths on disk
  const altPaths = [
    diskPath.replace('/tornozeleiras/', '/tornozeleira/'),
    diskPath.replace('/tornozeleira/', '/tornozeleiras/'),
    diskPath.replace('/braceletes/', '/bracelete/'),
    diskPath.replace('/bracelete/', '/braceletes/'),
    path.join(__dirname, 'assets', 'img', 'uploads', filename)
  ];
  for (const alt of altPaths) {
    if (fs.existsSync(alt) && fs.statSync(alt).isFile()) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(alt);
    }
  }

  // 2. Query uploaded image storage
  try {
    const dbImg = await getDbUploadedImage(filename) || await getDbUploadedImage(reqPath);
    if (dbImg && dbImg.data) {
      const buffer = Buffer.from(dbImg.data, 'base64');
      res.setHeader('Content-Type', dbImg.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(buffer);
    }
  } catch (e) {
    console.error('Erro ao buscar imagem no storage:', e);
  }

  // 3. Fallback placeholder
  const placeholderPath = path.join(__dirname, 'assets', 'img', 'placeholder.svg');
  if (fs.existsSync(placeholderPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(placeholderPath);
  }

  res.status(404).send('Image not found');
});

// ==========================================
// STATIC ASSETS & ADMIN PANEL ROUTES
// ==========================================

// Serve static assets with no-cache headers
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
}));

app.use('/css', express.static(path.join(__dirname, 'css'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
}));

app.use('/js', express.static(path.join(__dirname, 'js'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
}));

// Admin panel static assets (admin.css, admin.js)
app.use('/pages/admin', express.static(path.join(__dirname, 'pages', 'admin'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
}));

// Admin panel main HTML routes (all aliases)
app.get(['/admin', '/admin/', '/painel', '/painel/', '/admin.html', '/painel.html', '/pages/admin', '/pages/admin/', '/pages/admin/index.html', '/pages/admin/index'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, 'pages', 'admin', 'index.html'));
});

// Legacy data routes dynamically backed by PostgreSQL/Cache
app.get('/data/produtos/:setor/:categoria.json', async (req, res) => {
  const { setor, categoria } = req.params;
  const products = await getDbProducts(setor, categoria);
  res.json(products);
});

app.get('/data/links.json', async (req, res) => {
  const links = await getDbHomeLinks();
  res.json(links);
});

app.get('/data/category_names.json', async (req, res) => {
  const names = await getDbCategoryNames();
  res.json(names);
});

// Serve root static files (manifest, service worker, maintenance, root index)
app.get(['/', '/index.html', '/index', '/pages/index.html', '/pages', '/pages/'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/manutencao.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, 'manutencao.html'));
});

// ==========================================
// SECTORS & CATEGORIES DYNAMIC CATALOG ROUTES
// ==========================================

// Sector catalogs (semijoias and lingeries)
app.get(['/pages/:setor(semijoias|lingeries)', '/pages/:setor(semijoias|lingeries)/', '/pages/:setor(semijoias|lingeries)/index.html', '/pages/:setor(semijoias|lingeries)/index'], (req, res, next) => {
  const { setor } = req.params;
  const filePath = path.join(__dirname, 'pages', setor, 'index.html');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    return res.sendFile(filePath);
  }
  next();
});

// Catch any relative ../index.html link requested from category subfolder
app.get(['/pages/:setor(semijoias|lingeries)/:categoria/index.html', '/pages/:setor(semijoias|lingeries)/:categoria/index'], (req, res) => {
  const { setor } = req.params;
  res.redirect(302, `/pages/${setor}/index.html`);
});

// Dynamic Category Page Handler (with and without .html)
const serveCategoryHtml = async (req, res, next) => {
  const { setor, categoria } = req.params;
  if (!['semijoias', 'lingeries'].includes(setor)) {
    return next();
  }

  // If the category has no products, redirect to sector catalog
  const items = await getDbProducts(setor, categoria);
  if (!items || items.length === 0) {
    return res.redirect(302, `/pages/${setor}/index.html`);
  }

  const file = req.params.file || categoria;

  // Check physical file variations
  const possiblePaths = [
    path.join(__dirname, 'pages', setor, categoria, `${file}.html`),
    path.join(__dirname, 'pages', setor, categoria, `${categoria}.html`),
    path.join(__dirname, 'pages', setor, `${categoria}.html`),
    path.join(__dirname, 'pages', setor, categoria, 'index.html'),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      return res.sendFile(filePath);
    }
  }

  try {
    const catNames = await getDbCategoryNames();
    const catTitle = (catNames[setor] && catNames[setor][categoria]) || categoria;
    const html = `<!doctype html>
<html lang="PT-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/css/style.css" />
    <title>${catTitle} - Catálogo</title>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#5c1838" />
    <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/svg+xml" href="/assets/icons/icon.svg" />
    <script src="/js/pwa.js" defer></script>
  </head>
  <body>
    <header>
      <div class="div-principal">
        <h1>${catTitle}</h1>
      </div>
    </header>
    <div class="div-main">
      <h1>Nossos Produtos</h1>
      <div id="container-produtos" class="grid-produtos" data-setor="${setor}" data-categoria="${categoria}"></div>
      <div class="div-2">
        <a href="/pages/${setor}/index.html" class="link-retornar-anterior">Retornar à página anterior</a>
      </div>
    </div>
    <footer>
      <div class="div-footer">
        <p>Copyright © 2026 Revendedora Carol Alves. Todos os direitos reservados. | <a href="/pages/admin/index.html" class="link-admin-footer" style="color: #5c1838; font-weight: bold; text-decoration: underline;">Painel Administrativo</a></p>
      </div>
    </footer>
    <div id="zoom-modal" class="zoom-modal">
      <span class="zoom-fechar">&times;</span>
      <button class="zoom-seta zoom-prev" id="zoom-prev">&#10094;</button>
      <img class="zoom-conteudo" id="img-ampliada" alt="Imagem ampliada do produto" />
      <button class="zoom-seta zoom-next" id="zoom-next">&#10095;</button>
    </div>
    <script src="/js/main.js"></script>
  </body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    return res.send(html);
  } catch (err) {
    next();
  }
};

app.get('/pages/:setor(semijoias|lingeries)/:categoria/:file.html', serveCategoryHtml);
app.get('/pages/:setor(semijoias|lingeries)/:categoria', serveCategoryHtml);

// General static fallback for other pages
app.use('/pages', express.static(path.join(__dirname, 'pages'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
}));

// Start Server immediately
function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Painel de Administracao: http://localhost:${PORT}/pages/admin/index.html ou http://localhost:${PORT}/admin`);

    // Initialize and verify database storage
    seedDatabaseFromLocalFiles()
      .then(() => {
        console.log('Banco de dados PostgreSQL (Cloud SQL) inicializado e sincronizado com sucesso.');
      })
      .catch((e) => {
        console.warn('Aviso na inicialização do banco de dados PostgreSQL:', e.message);
      });
  });
}


startServer();
