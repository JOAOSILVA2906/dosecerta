-- Banco de dados do Dose Certa (SQLite)
-- Valores em dinheiro ficam em centavos (INTEGER) para não ter erro de arredondamento.

CREATE TABLE IF NOT EXISTS categorias (
  id    TEXT PRIMARY KEY,
  nome  TEXT NOT NULL,
  cor   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS farmacias (
  id          INTEGER PRIMARY KEY,
  nome        TEXT NOT NULL,
  endereco    TEXT NOT NULL,
  bairro      TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  abre        TEXT,             -- NULL = 24 horas
  fecha       TEXT,
  telefone    TEXT NOT NULL,
  nota        REAL NOT NULL,
  avaliacoes  INTEGER NOT NULL,
  fator_preco REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS medicamentos (
  id                   INTEGER PRIMARY KEY,
  nome                 TEXT NOT NULL,
  apresentacao         TEXT NOT NULL,
  forma                TEXT NOT NULL CHECK (forma IN ('comprimido', 'capsula', 'liquido', 'spray', 'sache')),
  categoria_id         TEXT NOT NULL REFERENCES categorias (id),
  preco_base_centavos  INTEGER NOT NULL CHECK (preco_base_centavos > 0),
  receita              TEXT NOT NULL CHECK (receita IN ('isento', 'simples', 'retencao')),
  generico             INTEGER NOT NULL DEFAULT 0,
  cadastrado_por       INTEGER REFERENCES farmacias (id),
  UNIQUE (nome, apresentacao)
);

CREATE TABLE IF NOT EXISTS estoque (
  farmacia_id     INTEGER NOT NULL REFERENCES farmacias (id),
  medicamento_id  INTEGER NOT NULL REFERENCES medicamentos (id),
  quantidade      INTEGER NOT NULL CHECK (quantidade >= 0),
  PRIMARY KEY (farmacia_id, medicamento_id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id                   INTEGER PRIMARY KEY,
  nome                 TEXT NOT NULL,
  email                TEXT UNIQUE COLLATE NOCASE,          -- NULL para quem compra sem cadastro
  senha_hash           TEXT,                                -- scrypt; nunca a senha em texto
  papel                TEXT NOT NULL CHECK (papel IN ('cliente', 'visitante', 'farmacia')),
  farmacia_id          INTEGER REFERENCES farmacias (id),   -- só para papel = 'farmacia'
  telefone             TEXT,
  notificacoes_lidas   INTEGER NOT NULL DEFAULT 0,
  criado_em            INTEGER NOT NULL,
  CHECK ((papel = 'farmacia') = (farmacia_id IS NOT NULL))
);

-- Guardamos só o hash do token da sessão: quem ler o banco não consegue se passar pelo usuário.
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  expira_em   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enderecos (
  usuario_id   INTEGER PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  cep          TEXT,
  rua          TEXT NOT NULL,
  numero       TEXT NOT NULL,
  bairro       TEXT NOT NULL,
  complemento  TEXT,
  lat          REAL,
  lng          REAL
);

CREATE TABLE IF NOT EXISTS pedidos (
  id                INTEGER PRIMARY KEY,
  farmacia_id       INTEGER NOT NULL REFERENCES farmacias (id),
  usuario_id        INTEGER REFERENCES usuarios (id),
  cliente_nome      TEXT NOT NULL,
  telefone          TEXT,
  tipo              TEXT NOT NULL CHECK (tipo IN ('entrega', 'retirada')),
  status            TEXT NOT NULL CHECK (status IN ('pendente', 'separacao', 'pronto', 'transporte', 'concluido', 'cancelado')),
  subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  taxa_centavos     INTEGER NOT NULL CHECK (taxa_centavos >= 0),
  total_centavos    INTEGER NOT NULL CHECK (total_centavos >= 0),
  pagamento         TEXT NOT NULL CHECK (pagamento IN ('pix', 'cartao', 'dinheiro')),
  troco_centavos    INTEGER,
  receita_arquivo   TEXT,
  endereco_texto    TEXT,
  lat               REAL,
  lng               REAL,
  bairro            TEXT NOT NULL,
  codigo_retirada   TEXT NOT NULL,
  prazo_minutos     INTEGER NOT NULL,
  motivo            TEXT,
  automatico        INTEGER NOT NULL DEFAULT 0,
  criado_em         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  pedido_id       INTEGER NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  medicamento_id  INTEGER NOT NULL REFERENCES medicamentos (id),
  nome            TEXT NOT NULL,
  apresentacao    TEXT NOT NULL,
  quantidade      INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 10),
  preco_centavos  INTEGER NOT NULL CHECK (preco_centavos > 0),
  PRIMARY KEY (pedido_id, medicamento_id)
);

CREATE TABLE IF NOT EXISTS pedido_historico (
  pedido_id  INTEGER NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  quando     INTEGER NOT NULL,
  PRIMARY KEY (pedido_id, status)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_farmacia ON pedidos (farmacia_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos (usuario_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes (expira_em);
