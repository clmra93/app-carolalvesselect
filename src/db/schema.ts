import { pgTable, serial, text, timestamp, integer, boolean, doublePrecision, jsonb } from 'drizzle-orm/pg-core';

// Users table (Firebase Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Admin Configuration (Email, PIN, WhatsApp)
export const adminConfig = pgTable('admin_config', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  pin: text('pin').notNull(),
  whatsapp: text('whatsapp').default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Categories for Semijoias and Lingeries
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  setor: text('setor').notNull(), // 'semijoias' | 'lingeries'
  catKey: text('cat_key').notNull(), // 'aneis', 'brincos', etc.
  nome: text('nome').notNull(),
  ordem: integer('ordem').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Home Page Links
export const homeLinks = pgTable('home_links', {
  id: serial('id').primaryKey(),
  linkId: integer('link_id'),
  titulo: text('titulo').notNull(),
  url: text('url').notNull(),
  tipo: text('tipo').notNull(), // 'interno' | 'externo'
  urlOriginal: text('url_original'),
  tipoOriginal: text('tipo_original'),
  ordem: integer('ordem').default(0),
  oculto: boolean('oculto').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Products
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  setor: text('setor').notNull(),
  categoria: text('categoria').notNull(),
  descricao: text('descricao'),
  codigo: text('codigo'),
  valor: doublePrecision('valor').default(0),
  precoPromocional: doublePrecision('preco_promocional'),
  status: text('status').default('disponivel'),
  tamanhos: jsonb('tamanhos'),
  fotos: jsonb('fotos'),
  detalhes: text('detalhes'),
  extraData: jsonb('extra_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Trash items
export const trash = pgTable('trash', {
  id: serial('id').primaryKey(),
  trashId: text('trash_id').notNull().unique(),
  productId: integer('product_id'),
  setor: text('setor').notNull(),
  categoria: text('categoria').notNull(),
  deletedAt: timestamp('deleted_at').defaultNow(),
  productData: jsonb('product_data').notNull(),
});

// Stored Files and Images (100% stored in PostgreSQL)
export const storedFiles = pgTable('stored_files', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull().unique(),
  originalName: text('original_name'),
  mimeType: text('mime_type').notNull(),
  data: text('data').notNull(), // Base64 encoded binary data
  size: integer('size').notNull(),
  category: text('category').default('uploads'),
  createdAt: timestamp('created_at').defaultNow(),
});

// System and Audit Logs
export const systemLogs = pgTable('system_logs', {
  id: serial('id').primaryKey(),
  logId: text('log_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  localTime: text('local_time'),
  level: text('level').notNull(),
  category: text('category').notNull(),
  message: text('message').notNull(),
  details: jsonb('details'),
  instanceId: text('instance_id'),
});
