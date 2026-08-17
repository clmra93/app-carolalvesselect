import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq, and, asc, desc } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  adminConfig,
  categories,
  homeLinks,
  products,
  trash,
  storedFiles,
  systemLogs
} from './schema.ts';
import { logEvent } from '../lib/logger.ts';

const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'data');
const assetsDir = path.join(rootDir, 'assets');


export const defaultCategoryNames = {
  lingeries: {
    soutiens: "Soutiens",
    calcinhas: "Calcinhas",
    cuecas: "Cuecas",
    conjunto: "Conjuntos",
    topper: "Toppers",
    pijamas: "Pijamas",
    infantil: "Infantil",
    meias: "Meias",
    bermuda: "Bermudas",
    sambacancao: "Samba Canção",
    shortanagua: "Short Anágua",
    camisolas: "Camisolas"
  },
  semijoias: {
    aneis: "Anéis",
    brincos: "Brincos",
    brincoArgola: "Brincos de Argola",
    colares: "Colares & Cordões",
    conjuntos: "Conjuntos",
    correntes: "Correntes (Sem Pingente)",
    pulseiras: "Pulseiras",
    tornozeleiras: "Tornozeleiras",
    bracelete: "Braceletes",
    braceletes: "Braceletes",
    pingentes: "Pingentes"
  }
};

export const defaultHomeLinks = [
  {
    id: 1,
    url: "/pages/semijoias/index.html",
    tipo: "interno",
    titulo: "Catálogo Semi-Joias Styllus",
    urlOriginal: "/pages/semijoias/index.html",
    tipoOriginal: "interno"
  },
  {
    id: 2,
    url: "/pages/lingeries/index.html",
    tipo: "interno",
    titulo: "Catálogo Lingeries Bella",
    urlOriginal: "/pages/lingeries/index.html",
    tipoOriginal: "interno"
  },
  {
    id: 3,
    url: "https://minhaloja.grupoboticario.com.br/carollalves",
    tipo: "externo",
    titulo: "Minha Loja - Grupo Boticário",
    urlOriginal: "https://minhaloja.grupoboticario.com.br/carollalves",
    tipoOriginal: "externo"
  },
  {
    id: 4,
    url: "https://catalogoportaaporta.cancaonova.com/gv-editora/cancao-nova/catalogo/",
    tipo: "externo",
    titulo: "Catálogo Porta a Porta",
    urlOriginal: "https://catalogoportaaporta.cancaonova.com/gv-editora/cancao-nova/catalogo/",
    tipoOriginal: "externo"
  },
  {
    id: 5,
    url: "https://loja.marykay.com.br/minha-vitrine?slug=carolalvesmk",
    tipo: "externo",
    titulo: "Minha Loja - Mary Kay",
    urlOriginal: "https://loja.marykay.com.br/minha-vitrine?slug=carolalvesmk",
    tipoOriginal: "externo"
  },
  {
    id: 6,
    url: "https://agreements.marykayintouch.com.br/r/c7oj5g1k",
    tipo: "externo",
    titulo: "Faça seu cadastro - Mary Kay",
    urlOriginal: "https://agreements.marykayintouch.com.br/r/c7oj5g1k",
    tipoOriginal: "externo"
  },
  {
    id: 7,
    url: "https://collshp.com/calummara",
    tipo: "externo",
    titulo: "Coleção Shopee",
    urlOriginal: "https://collshp.com/calummara",
    tipoOriginal: "externo"
  }
];

export const defaultAdminConfig = { email: 'clmr93@gmail.com', pin: 'Cl@9313', whatsapp: '' };

const readJsonFile = <T>(filePath: string, fallback: T): T => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Erro ao ler arquivo ${filePath}:`, err);
  }
  return fallback;
};

// Seed / Initial Migration of all local files and JSONs into PostgreSQL
export async function seedDatabaseFromLocalFiles() {
  try {
    // 1. Admin Config
    const existingAdmin = await db.select().from(adminConfig).limit(1);
    if (existingAdmin.length === 0) {
      const localAdmin = readJsonFile(path.join(dataDir, 'admin_config.json'), defaultAdminConfig);
      await db.insert(adminConfig).values({
        email: localAdmin.email || defaultAdminConfig.email,
        pin: localAdmin.pin || defaultAdminConfig.pin,
        whatsapp: localAdmin.whatsapp || ''
      });
      console.log('✅ Admin config seeded into PostgreSQL');
    }

    // 2. Categories
    const existingCats = await db.select().from(categories).limit(1);
    if (existingCats.length === 0) {
      const localCats = readJsonFile(path.join(dataDir, 'category_names.json'), defaultCategoryNames);
      const catRows: any[] = [];
      let order = 1;
      for (const setor of ['lingeries', 'semijoias']) {
        const setorMap = (localCats as any)[setor] || {};
        for (const [catKey, nome] of Object.entries(setorMap)) {
          catRows.push({
            setor,
            catKey,
            nome: String(nome),
            ordem: order++
          });
        }
      }
      if (catRows.length > 0) {
        await db.insert(categories).values(catRows);
        console.log(`✅ ${catRows.length} Categories seeded into PostgreSQL`);
      }
    }

    // 3. Home Links
    const existingLinks = await db.select().from(homeLinks).limit(1);
    if (existingLinks.length === 0) {
      const localLinks = readJsonFile(path.join(dataDir, 'home_links.json'), defaultHomeLinks);
      const linkRows = (Array.isArray(localLinks) ? localLinks : defaultHomeLinks).map((l: any, idx: number) => ({
        linkId: l.id || idx + 1,
        titulo: l.titulo || 'Link',
        url: l.url || '#',
        tipo: l.tipo || 'interno',
        urlOriginal: l.urlOriginal || l.url,
        tipoOriginal: l.tipoOriginal || l.tipo,
        ordem: idx,
        oculto: !!l.oculto
      }));
      if (linkRows.length > 0) {
        await db.insert(homeLinks).values(linkRows);
        console.log(`✅ ${linkRows.length} Home links seeded into PostgreSQL`);
      }
    }

    // 4. Products
    const existingProducts = await db.select().from(products).limit(1);
    if (existingProducts.length === 0) {
      const productRows: any[] = [];
      for (const setor of ['semijoias', 'lingeries']) {
        const setorDir = path.join(dataDir, 'products', setor);
        if (fs.existsSync(setorDir)) {
          const files = fs.readdirSync(setorDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const catKey = file.replace('.json', '');
              const items = readJsonFile<any[]>(path.join(setorDir, file), []);
              if (Array.isArray(items)) {
                items.forEach((p, idx) => {
                  productRows.push({
                    productId: p.id || (idx + 1),
                    setor,
                    categoria: catKey,
                    descricao: p.descricao || '',
                    codigo: p.codigo || '',
                    valor: typeof p.valor === 'number' ? p.valor : parseFloat(String(p.valor || '0').replace(',', '.')) || 0,
                    precoPromocional: p.precoPromocional ? (typeof p.precoPromocional === 'number' ? p.precoPromocional : parseFloat(String(p.precoPromocional).replace(',', '.'))) : null,
                    status: p.status || 'disponivel',
                    tamanhos: p.tamanhos || null,
                    fotos: p.fotos || null,
                    detalhes: p.detalhes || null,
                    extraData: p
                  });
                });
              }
            }
          }
        }
      }
      if (productRows.length > 0) {
        // Insert in batches of 50
        for (let i = 0; i < productRows.length; i += 50) {
          await db.insert(products).values(productRows.slice(i, i + 50));
        }
        console.log(`✅ ${productRows.length} Products seeded into PostgreSQL`);
      }
    }

    // 5. Trash
    const existingTrash = await db.select().from(trash).limit(1);
    if (existingTrash.length === 0) {
      const localTrash = readJsonFile<any[]>(path.join(dataDir, 'trash.json'), []);
      if (Array.isArray(localTrash) && localTrash.length > 0) {
        const trashRows = localTrash.map((t, idx) => ({
          trashId: t.trashId || `trash_${Date.now()}_${idx}`,
          productId: t.id || null,
          setor: t.setor || 'semijoias',
          categoria: t.categoria || 'geral',
          deletedAt: t.deletedAt ? new Date(t.deletedAt) : new Date(),
          productData: t.product || t
        }));
        await db.insert(trash).values(trashRows);
        console.log(`✅ ${trashRows.length} Trash items seeded into PostgreSQL`);
      }
    }

    // 6. Migrate all files and images from /assets/ into stored_files table in PostgreSQL
    const existingFilesCount = (await db.select().from(storedFiles).limit(1)).length;
    if (existingFilesCount === 0) {
      await migrateAssetsDirectoryToPostgres(assetsDir);
    }

    logEvent('INFO', 'DATABASE', 'Banco de dados PostgreSQL (Cloud SQL) verificado e sincronizado 100%.');
  } catch (err: any) {
    console.error('Erro na inicialização e sincronização do PostgreSQL:', err);
    logEvent('ERROR', 'DATABASE', 'Falha ao sincronizar dados no PostgreSQL', { error: err.message });
  }
}

// Recursive helper to import all image assets into PostgreSQL stored_files table
async function migrateAssetsDirectoryToPostgres(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await migrateAssetsDirectoryToPostgres(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.avif', '.ico'];
      if (validExts.includes(ext)) {
        try {
          const relativeAssetPath = fullPath.replace(rootDir, '').replace(/\\/g, '/');
          const filename = entry.name;
          const stat = fs.statSync(fullPath);
          const buffer = fs.readFileSync(fullPath);
          const dataBase64 = buffer.toString('base64');
          const mimeType = ext === '.png' ? 'image/png'
            : ext === '.webp' ? 'image/webp'
            : ext === '.svg' ? 'image/svg+xml'
            : ext === '.ico' ? 'image/x-icon'
            : 'image/jpeg';

          await db.insert(storedFiles).values({
            filename: filename,
            originalName: relativeAssetPath,
            mimeType,
            data: dataBase64,
            size: stat.size,
            category: path.basename(path.dirname(fullPath)) || 'assets'
          }).onConflictDoNothing();
        } catch (e: any) {
          console.warn(`Aviso ao migrar arquivo ${entry.name} para PostgreSQL:`, e.message);
        }
      }
    }
  }
}

// Category Names API
export async function getDbCategoryNames(): Promise<typeof defaultCategoryNames> {
  try {
    const rows = await db.select().from(categories).orderBy(asc(categories.ordem));
    if (rows.length === 0) {
      return defaultCategoryNames;
    }

    const result: any = { lingeries: {}, semijoias: {} };
    for (const row of rows) {
      if (!result[row.setor]) result[row.setor] = {};
      result[row.setor][row.catKey] = row.nome;
    }

    // Ensure default fallbacks are present if any key is missing
    result.lingeries = { ...defaultCategoryNames.lingeries, ...result.lingeries };
    result.semijoias = { ...defaultCategoryNames.semijoias, ...result.semijoias };

    return result;
  } catch (error) {
    console.error('Erro ao ler categorias do PostgreSQL:', error);
    return defaultCategoryNames;
  }
}

export async function saveDbCategoryNames(names: any) {
  try {
    if (!names || typeof names !== 'object') return;

    let order = 1;
    for (const setor of ['lingeries', 'semijoias']) {
      const setorMap = names[setor] || {};
      for (const [catKey, nome] of Object.entries(setorMap)) {
        const existing = await db.select().from(categories).where(and(eq(categories.setor, setor), eq(categories.catKey, catKey))).limit(1);
        if (existing.length > 0) {
          await db.update(categories).set({ nome: String(nome), ordem: order++ }).where(eq(categories.id, existing[0].id));
        } else {
          await db.insert(categories).values({
            setor,
            catKey,
            nome: String(nome),
            ordem: order++
          });
        }
      }
    }
    logEvent('AUDIT', 'ADMIN_ACTION', 'Categorias atualizadas no PostgreSQL');
  } catch (error) {
    console.error('Erro ao salvar categorias no PostgreSQL:', error);
    throw new Error('Falha ao salvar categorias no banco de dados.', { cause: error });
  }
}

// Home Links API
export async function getDbHomeLinks(): Promise<any[]> {
  try {
    const rows = await db.select().from(homeLinks).orderBy(asc(homeLinks.ordem), asc(homeLinks.id));
    if (rows.length === 0) {
      return defaultHomeLinks;
    }
    return rows.map(r => ({
      id: r.linkId || r.id,
      titulo: r.titulo,
      url: r.url,
      tipo: r.tipo,
      urlOriginal: r.urlOriginal,
      tipoOriginal: r.tipoOriginal,
      oculto: r.oculto
    }));
  } catch (error) {
    console.error('Erro ao ler links do PostgreSQL:', error);
    return defaultHomeLinks;
  }
}

export async function saveDbHomeLinks(links: any[]) {
  try {
    const cleanLinks = Array.isArray(links) ? links : [];
    await db.delete(homeLinks);

    if (cleanLinks.length > 0) {
      const rows = cleanLinks.map((l, idx) => ({
        linkId: l.id || idx + 1,
        titulo: l.titulo || 'Link',
        url: l.url || '#',
        tipo: l.tipo || 'interno',
        urlOriginal: l.urlOriginal || l.url,
        tipoOriginal: l.tipoOriginal || l.tipo,
        ordem: idx,
        oculto: !!l.oculto
      }));
      await db.insert(homeLinks).values(rows);
    }
    logEvent('AUDIT', 'ADMIN_ACTION', 'Links da home atualizados no PostgreSQL', { count: cleanLinks.length });
  } catch (error) {
    console.error('Erro ao salvar links no PostgreSQL:', error);
    throw new Error('Falha ao salvar links no banco de dados.', { cause: error });
  }
}

// Admin Config API
export async function getDbAdminConfig(): Promise<{ email: string; pin: string; whatsapp?: string }> {
  try {
    const rows = await db.select().from(adminConfig).orderBy(desc(adminConfig.id)).limit(1);
    if (rows.length > 0) {
      return {
        email: rows[0].email,
        pin: rows[0].pin,
        whatsapp: rows[0].whatsapp || ''
      };
    }
    return defaultAdminConfig;
  } catch (error) {
    console.error('Erro ao obter adminConfig do PostgreSQL:', error);
    return defaultAdminConfig;
  }
}

export async function saveDbAdminConfig(config: { email: string; pin: string; whatsapp?: string }) {
  try {
    const existing = await db.select().from(adminConfig).limit(1);
    if (existing.length > 0) {
      await db.update(adminConfig).set({
        email: config.email,
        pin: config.pin,
        whatsapp: config.whatsapp || '',
        updatedAt: new Date()
      }).where(eq(adminConfig.id, existing[0].id));
    } else {
      await db.insert(adminConfig).values({
        email: config.email,
        pin: config.pin,
        whatsapp: config.whatsapp || ''
      });
    }
    logEvent('AUDIT', 'AUTH', 'Credenciais de admin salvas no PostgreSQL', { email: config.email });
  } catch (error) {
    console.error('Erro ao salvar adminConfig no PostgreSQL:', error);
    throw new Error('Falha ao atualizar configurações no banco de dados.', { cause: error });
  }
}

// Products API per Category
export async function getDbProducts(setor: string, categoria: string): Promise<any[]> {
  try {
    const rows = await db.select().from(products)
      .where(and(eq(products.setor, setor), eq(products.categoria, categoria)))
      .orderBy(desc(products.id));

    return rows.map(r => ({
      id: r.productId,
      dbId: r.id,
      setor: r.setor,
      categoria: r.categoria,
      descricao: r.descricao,
      codigo: r.codigo,
      valor: r.valor,
      precoPromocional: r.precoPromocional,
      status: r.status,
      tamanhos: r.tamanhos,
      fotos: r.fotos,
      detalhes: r.detalhes,
      ...(typeof r.extraData === 'object' && r.extraData !== null ? r.extraData : {})
    }));
  } catch (error) {
    console.error(`Erro ao buscar produtos ${setor}/${categoria} no PostgreSQL:`, error);
    return [];
  }
}

export async function saveDbCategoryProducts(setor: string, categoria: string, items: any[]) {
  try {
    const cleanItems = Array.isArray(items) ? items : [];

    // Delete existing products for this sector and category
    await db.delete(products).where(and(eq(products.setor, setor), eq(products.categoria, categoria)));

    if (cleanItems.length > 0) {
      const rows = cleanItems.map((p, idx) => ({
        productId: typeof p.id === 'number' ? p.id : (idx + 1),
        setor,
        categoria,
        descricao: p.descricao || '',
        codigo: p.codigo || '',
        valor: typeof p.valor === 'number' ? p.valor : (parseFloat(String(p.valor || '0').replace(',', '.')) || 0),
        precoPromocional: p.precoPromocional !== undefined && p.precoPromocional !== null ? (typeof p.precoPromocional === 'number' ? p.precoPromocional : parseFloat(String(p.precoPromocional).replace(',', '.'))) : null,
        status: p.status || 'disponivel',
        tamanhos: p.tamanhos || null,
        fotos: p.fotos || null,
        detalhes: p.detalhes || null,
        extraData: p
      }));

      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        await db.insert(products).values(rows.slice(i, i + 50));
      }
    }
    logEvent('AUDIT', 'ADMIN_ACTION', `Produtos salvos no PostgreSQL para ${setor}/${categoria}`, { count: cleanItems.length });
  } catch (error) {
    console.error(`Erro ao salvar produtos ${setor}/${categoria} no PostgreSQL:`, error);
    throw new Error('Falha ao salvar produtos no banco de dados.', { cause: error });
  }
}

// Get All Products across all categories
export async function getAllDbProducts(): Promise<any[]> {
  try {
    const rows = await db.select().from(products).orderBy(desc(products.id));
    return rows.map(r => ({
      id: r.productId,
      dbId: r.id,
      setor: r.setor,
      categoria: r.categoria,
      descricao: r.descricao,
      codigo: r.codigo,
      valor: r.valor,
      precoPromocional: r.precoPromocional,
      status: r.status,
      tamanhos: r.tamanhos,
      fotos: r.fotos,
      detalhes: r.detalhes,
      ...(typeof r.extraData === 'object' && r.extraData !== null ? r.extraData : {})
    }));
  } catch (error) {
    console.error('Erro ao ler todos os produtos do PostgreSQL:', error);
    return [];
  }
}

// Trash Management
export async function getDbTrash(): Promise<any[]> {
  try {
    const rows = await db.select().from(trash).orderBy(desc(trash.id));
    return rows.map(r => ({
      trashId: r.trashId,
      id: r.productId,
      setor: r.setor,
      categoria: r.categoria,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : new Date().toISOString(),
      product: r.productData
    }));
  } catch (error) {
    console.error('Erro ao ler lixeira do PostgreSQL:', error);
    return [];
  }
}

export async function saveDbTrash(trashItems: any[]) {
  try {
    const cleanItems = Array.isArray(trashItems) ? trashItems : [];
    await db.delete(trash);

    if (cleanItems.length > 0) {
      const rows = cleanItems.map((t, idx) => ({
        trashId: t.trashId || `trash_${Date.now()}_${idx}`,
        productId: t.id || (t.product && t.product.id) || null,
        setor: t.setor || (t.product && t.product.setor) || 'semijoias',
        categoria: t.categoria || (t.product && t.product.categoria) || 'geral',
        deletedAt: t.deletedAt ? new Date(t.deletedAt) : new Date(),
        productData: t.product || t
      }));
      await db.insert(trash).values(rows);
    }
  } catch (error) {
    console.error('Erro ao salvar lixeira no PostgreSQL:', error);
    throw new Error('Falha ao atualizar lixeira no banco de dados.', { cause: error });
  }
}

// Uploaded & Stored Files Storage in PostgreSQL
export async function saveDbUploadedImage(img: { filename: string; originalName?: string; mimeType: string; data: string; size: number; category?: string }) {
  try {
    const cleanFilename = path.basename(img.filename);
    const existing = await db.select().from(storedFiles).where(eq(storedFiles.filename, cleanFilename)).limit(1);

    if (existing.length > 0) {
      await db.update(storedFiles).set({
        originalName: img.originalName || cleanFilename,
        mimeType: img.mimeType,
        data: img.data,
        size: img.size,
        category: img.category || 'uploads',
        createdAt: new Date()
      }).where(eq(storedFiles.filename, cleanFilename));
    } else {
      await db.insert(storedFiles).values({
        filename: cleanFilename,
        originalName: img.originalName || cleanFilename,
        mimeType: img.mimeType,
        data: img.data,
        size: img.size,
        category: img.category || 'uploads'
      });
    }

    logEvent('INFO', 'DATABASE', `Arquivo/Imagem persistida no PostgreSQL: ${cleanFilename}`, { size: img.size });
  } catch (err: any) {
    console.error(`Erro ao gravar arquivo no PostgreSQL: ${img.filename}:`, err);
    logEvent('ERROR', 'DATABASE', `Erro ao gravar imagem no PostgreSQL: ${img.filename}`, { error: err.message });
    throw new Error('Falha ao persistir imagem no banco de dados.', { cause: err });
  }
}

export async function getDbUploadedImage(filenameOrPath: string) {
  try {
    const cleanFilename = path.basename(filenameOrPath);
    const rows = await db.select().from(storedFiles)
      .where(eq(storedFiles.filename, cleanFilename))
      .limit(1);

    if (rows.length > 0) {
      return {
        filename: rows[0].filename,
        originalName: rows[0].originalName,
        mimeType: rows[0].mimeType,
        data: rows[0].data,
        size: rows[0].size,
        category: rows[0].category,
        createdAt: rows[0].createdAt
      };
    }

    // Try finding by originalName substring
    const altRows = await db.select().from(storedFiles)
      .where(eq(storedFiles.originalName, filenameOrPath))
      .limit(1);

    if (altRows.length > 0) {
      return {
        filename: altRows[0].filename,
        originalName: altRows[0].originalName,
        mimeType: altRows[0].mimeType,
        data: altRows[0].data,
        size: altRows[0].size,
        category: altRows[0].category,
        createdAt: altRows[0].createdAt
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao ler arquivo do PostgreSQL:', error);
    return null;
  }
}

export async function getAllDbUploadedImages() {
  try {
    const rows = await db.select().from(storedFiles).orderBy(desc(storedFiles.id));
    return rows.map(r => ({
      filename: r.filename,
      originalName: r.originalName || `/assets/img/uploads/${r.filename}`,
      mimeType: r.mimeType,
      size: r.size,
      category: r.category,
      createdAt: r.createdAt
    }));
  } catch (err) {
    console.error('Erro ao listar arquivos do PostgreSQL:', err);
    return [];
  }
}
