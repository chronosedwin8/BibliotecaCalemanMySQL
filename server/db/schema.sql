-- ============================================================
-- BIBLIOTECA — Esquema MySQL 8
-- charset: utf8mb4  collation: utf8mb4_spanish2_ci
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(255) NOT NULL UNIQUE,
  descripcion TEXT,
  color_hex   VARCHAR(20)  DEFAULT '#3B82F6',
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- ------------------------------------------------------------
-- 2. locations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  shelf_name        VARCHAR(255) NOT NULL,
  section           VARCHAR(255),
  `row`             VARCHAR(100),
  capacity          INT DEFAULT 100,
  current_occupancy INT DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- ------------------------------------------------------------
-- 3. profiles  (fusiona auth.users + public.profiles de Supabase)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                    CHAR(36)     NOT NULL PRIMARY KEY,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  full_name             VARCHAR(255),
  role                  ENUM('admin','teacher','student') DEFAULT 'student',
  codigo_identificacion VARCHAR(100) UNIQUE,
  telefono              VARCHAR(50),
  estado                ENUM('activo','inactivo','suspendido') DEFAULT 'activo',
  avatar_url            TEXT,
  section               VARCHAR(100),
  course                VARCHAR(100),
  level                 VARCHAR(100),
  password_hash         VARCHAR(255) NOT NULL DEFAULT '',
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- ------------------------------------------------------------
-- 4. books
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id                    CHAR(36)     NOT NULL PRIMARY KEY,
  titulo                VARCHAR(500) NOT NULL,
  autor                 VARCHAR(500) NOT NULL,
  isbn                  VARCHAR(50),
  editorial             VARCHAR(255),
  anio_publicacion      INT,
  categoria_id          BIGINT,
  ubicacion_id          BIGINT,
  cantidad_total        INT  NOT NULL DEFAULT 1,
  cantidad_disponible   INT  NOT NULL DEFAULT 1,
  codigo_barras         VARCHAR(100) UNIQUE,
  imagen_portada_url    TEXT,
  estado                ENUM('disponible','prestado','dañado','perdido') DEFAULT 'disponible',
  -- Extended fields (migration_new_book_fields)
  coleccion             VARCHAR(255),
  numero_inventario     VARCHAR(100),
  fecha_ingreso         DATE,
  formato_material      VARCHAR(100),
  idioma                VARCHAR(100) DEFAULT 'Español',
  numero_clasificacion  VARCHAR(100),
  titulo_paralelo       VARCHAR(500),
  numero_ejemplar       INT DEFAULT 1,
  lugar_publicacion     VARCHAR(255),
  mencion_serie         VARCHAR(255),
  numero_paginas        VARCHAR(50),
  terminos_tematicos    TEXT,
  fecha_adquisicion     DATE,
  precio                DECIMAL(10,2),
  orden_compra          VARCHAR(100),
  nota                  TEXT,
  resena                TEXT,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_books_category  FOREIGN KEY (categoria_id)  REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_books_location  FOREIGN KEY (ubicacion_id)  REFERENCES locations(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- Indexes para búsqueda/filtro
CREATE INDEX idx_books_titulo       ON books(titulo(100));
CREATE INDEX idx_books_autor        ON books(autor(100));
CREATE INDEX idx_books_isbn         ON books(isbn);
CREATE INDEX idx_books_coleccion    ON books(coleccion);
CREATE INDEX idx_books_idioma       ON books(idioma);
CREATE INDEX idx_books_formato      ON books(formato_material);
CREATE INDEX idx_books_num_inv      ON books(numero_inventario);
CREATE INDEX idx_books_num_clas     ON books(numero_clasificacion);
ALTER TABLE books ADD FULLTEXT INDEX ft_books_search (titulo, autor, isbn, editorial, numero_clasificacion, terminos_tematicos, numero_inventario, coleccion, codigo_barras, resena);

-- ------------------------------------------------------------
-- 5. loans
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
  id                          CHAR(36) NOT NULL PRIMARY KEY,
  libro_id                    CHAR(36) NOT NULL,
  usuario_id                  CHAR(36) NOT NULL,
  fecha_prestamo              DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion_estimada   DATETIME NOT NULL,
  fecha_devolucion_real       DATETIME,
  estado                      ENUM('active','returned','overdue') DEFAULT 'active',
  renovaciones                INT DEFAULT 0,
  created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_book    FOREIGN KEY (libro_id)    REFERENCES books(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_loans_profile FOREIGN KEY (usuario_id)  REFERENCES profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

CREATE INDEX idx_loans_usuario  ON loans(usuario_id);
CREATE INDEX idx_loans_libro    ON loans(libro_id);
CREATE INDEX idx_loans_estado   ON loans(estado);
CREATE INDEX idx_loans_created  ON loans(created_at);

-- Trigger: descontar disponibilidad al crear préstamo
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS trg_loan_checkout
AFTER INSERT ON loans
FOR EACH ROW
BEGIN
  UPDATE books SET cantidad_disponible = cantidad_disponible - 1 WHERE id = NEW.libro_id;
END$$
DELIMITER ;

-- Trigger: reponer disponibilidad al devolver
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS trg_loan_return
AFTER UPDATE ON loans
FOR EACH ROW
BEGIN
  IF NEW.estado = 'returned' AND OLD.estado != 'returned' THEN
    UPDATE books SET cantidad_disponible = cantidad_disponible + 1 WHERE id = NEW.libro_id;
  END IF;
END$$
DELIMITER ;

-- ------------------------------------------------------------
-- 6. reservas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas (
  id                 CHAR(36) NOT NULL PRIMARY KEY,
  libro_id           CHAR(36) NOT NULL,
  usuario_id         CHAR(36) NOT NULL,
  fecha_reserva      DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion   DATETIME NOT NULL,
  estado             ENUM('pendiente','completada','cancelada','expirada') DEFAULT 'pendiente',
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservas_book    FOREIGN KEY (libro_id)   REFERENCES books(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_reservas_profile FOREIGN KEY (usuario_id) REFERENCES profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- ------------------------------------------------------------
-- 7. multas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS multas (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  prestamo_id      CHAR(36),
  usuario_id       CHAR(36) NOT NULL,
  monto            DECIMAL(10,2) NOT NULL,
  motivo           TEXT,
  estado           ENUM('pendiente','pagada','condonada') DEFAULT 'pendiente',
  fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_pago       DATETIME,
  CONSTRAINT fk_multas_loan    FOREIGN KEY (prestamo_id) REFERENCES loans(id)    ON DELETE SET NULL,
  CONSTRAINT fk_multas_profile FOREIGN KEY (usuario_id)  REFERENCES profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

CREATE INDEX idx_multas_usuario ON multas(usuario_id);
CREATE INDEX idx_multas_estado  ON multas(estado);

-- ------------------------------------------------------------
-- 8. notificaciones
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  usuario_id CHAR(36)     NOT NULL,
  tipo       VARCHAR(100) NOT NULL,
  mensaje    TEXT         NOT NULL,
  leida      TINYINT(1)   DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_profile FOREIGN KEY (usuario_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- ------------------------------------------------------------
-- 9. configuracion_sistema
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  clave       VARCHAR(255) NOT NULL UNIQUE,
  valor       TEXT         NOT NULL,
  tipo_dato   VARCHAR(50)  DEFAULT 'string',
  descripcion TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

INSERT IGNORE INTO configuracion_sistema (clave, valor, tipo_dato, descripcion) VALUES
  ('dias_prestamo_estudiante', '7',   'number', 'Días de préstamo para estudiantes'),
  ('dias_prestamo_profesor',   '14',  'number', 'Días de préstamo para profesores'),
  ('dias_prestamo_admin',      '30',  'number', 'Días de préstamo para administradores'),
  ('limite_libros_por_usuario','3',   'number', 'Límite máximo de libros por usuario'),
  ('max_renovaciones',         '2',   'number', 'Máximo de renovaciones permitidas'),
  ('tarifa_multa_dia',         '500', 'number', 'Tarifa por cada día de atraso'),
  ('expiracion_reserva_horas', '48',  'number', 'Horas antes de que expire una reserva');

-- ------------------------------------------------------------
-- 10. cached_books  (cache para búsquedas archive.org)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cached_books (
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  query_text VARCHAR(500) NOT NULL UNIQUE,
  results    JSON         NOT NULL,
  cached_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

CREATE INDEX idx_cached_books_query     ON cached_books(query_text);
CREATE INDEX idx_cached_books_cached_at ON cached_books(cached_at);

-- ------------------------------------------------------------
-- 11. cached_recommendations  (singleton)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cached_recommendations (
  id        CHAR(36) NOT NULL PRIMARY KEY,
  results   JSON     NOT NULL,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- ------------------------------------------------------------
-- 12. journals  (investigación DOAJ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journals (
  id           VARCHAR(255) NOT NULL PRIMARY KEY,
  title        TEXT         NOT NULL,
  issn_print   VARCHAR(20),
  issn_online  VARCHAR(20),
  publisher    VARCHAR(500),
  country      VARCHAR(100),
  language     JSON,
  subjects     JSON,
  license      VARCHAR(100),
  url          TEXT,
  last_updated DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

-- ------------------------------------------------------------
-- 13. articles  (investigación DOAJ cache)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id               VARCHAR(255) NOT NULL PRIMARY KEY,
  title            TEXT         NOT NULL,
  abstract_text    TEXT,
  authors          JSON         DEFAULT (JSON_ARRAY()),
  journal_id       VARCHAR(255),
  journal_title    VARCHAR(500),
  publication_date DATE,
  keywords         JSON         DEFAULT (JSON_ARRAY()),
  doi              VARCHAR(255),
  url              TEXT,
  language         VARCHAR(50),
  source           VARCHAR(50)  DEFAULT 'doaj',
  last_updated     DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_articles_journal FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish2_ci;

CREATE INDEX idx_articles_pub_date   ON articles(publication_date);
CREATE INDEX idx_articles_journal_id ON articles(journal_id);
CREATE INDEX idx_articles_doi        ON articles(doi);
ALTER TABLE articles ADD FULLTEXT INDEX ft_articles_search (title, abstract_text);

SET FOREIGN_KEY_CHECKS = 1;
