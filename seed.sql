-- Demo user (password: demo123)
INSERT OR IGNORE INTO users (id, email, password_hash, name, company, phone) VALUES
  (1, 'demo@shtorcrm.ru', 'demo123', 'Шалыга Виктор Дмитриевич', 'DÉCOR BONJOUR', '+7 (918) 555-80-94');

-- Owner settings (executor data for contracts)
INSERT OR REPLACE INTO owner_settings (user_id, company_name, owner_name, owner_name_short, ogrn, inn, kpp,
  legal_address, actual_address, phone, phone2, bank_name, bank_bik, bank_account, bank_corr_account) VALUES
  (1, '«DÉCOR BONJOUR» ИП Шалыга В.Д.', 'Шалыга Виктор Дмитриевич', 'Шалыга В. Д.',
   '304616235700206', '616205867239', '0',
   'г. Ростов-на-Дону, Мадояна 75 а', 'г. Ростов-на-Дону, пр. Сиверса 23',
   '+7 (918) 555-80-94', '+7 (918) 555-80-96',
   'ФИЛИАЛ "РОСТОВСКИЙ" АО "АЛЬФА-БАНК" г. Ростов-на-Дону',
   '046015207', '40802810726070000783', '30101810500000000207');

-- Suppliers
INSERT OR IGNORE INTO suppliers (id, user_id, name, contact, phone, website) VALUES
  (1, 1, 'ТканиПро', 'Алексей Смирнов', '+7 (495) 111-22-33', 'tkanipro.ru'),
  (2, 1, 'Шёлковый путь', 'Елена Петрова', '+7 (495) 444-55-66', 'silkway.ru'),
  (3, 1, 'EuroTextile', 'Марко Росси', '+7 (495) 777-88-99', 'eurotextile.com');

-- Fabrics
INSERT OR IGNORE INTO fabrics (id, user_id, supplier_id, name, article, composition, width_cm, price_per_meter, in_stock) VALUES
  (1, 1, 1, 'Бархат "Версаль"', 'VRS-001', '100% полиэстер', 280, 1850, 1),
  (2, 1, 1, 'Лён натуральный', 'LN-045', '100% лён', 150, 980, 1),
  (3, 1, 1, 'Жаккард "Ренессанс"', 'JK-120', '70% хлопок, 30% полиэстер', 300, 2400, 1),
  (4, 1, 2, 'Шёлк "Муар"', 'SLK-008', '100% шёлк', 140, 4500, 1),
  (5, 1, 2, 'Органза с вышивкой', 'ORG-015', '100% полиэстер', 300, 1200, 1),
  (6, 1, 2, 'Тюль "Кристалл"', 'TL-032', '100% полиэстер', 300, 650, 1),
  (7, 1, 3, 'Блэкаут "Премиум"', 'BLK-001', '100% полиэстер, 3 слоя', 280, 1650, 1),
  (8, 1, 3, 'Портьера "Милан"', 'MLN-044', '80% хлопок, 20% полиэстер', 280, 3200, 1),
  (9, 1, 3, 'Димаут "Софт"', 'DIM-007', '100% полиэстер', 300, 1100, 1),
  (10, 1, 1, 'Хлопок "Прованс"', 'HLP-023', '100% хлопок', 150, 750, 1);

-- Clients (3 types: person, ip, company)
INSERT OR IGNORE INTO clients (id, user_id, name, phone, email, address, notes, client_type,
  passport_series, passport_number, passport_date, passport_issued, passport_code) VALUES
  (1, 1, 'Петрова Анна Сергеевна', '+7 (903) 111-22-33', 'petrova@mail.ru', 'г. Ростов-на-Дону, ул. Ленина, д. 15, кв. 42',
   'Предпочитает классический стиль', 'person', '60 04', '123456', '15.03.2005', 'ОВД Ворошиловского р-на г. Ростов-на-Дону', '612-005');

INSERT OR IGNORE INTO clients (id, user_id, name, phone, email, address, notes, client_type,
  company_name, inn, kpp, ogrn, legal_address, contact_person, bank_name, bank_bik, bank_account, bank_corr_account) VALUES
  (2, 1, 'Сидоров Дмитрий Игоревич', '+7 (905) 444-55-66', 'sidorov@gmail.com', 'г. Ростов-на-Дону, пр. Мира, д. 78',
   'ИП, работает по безналу', 'ip',
   'ИП Сидоров Д.И.', '616312345678', '', '312345678901234', 'г. Ростов-на-Дону, пр. Мира, д. 78',
   'Сидоров Д.И.', 'ПАО СБЕРБАНК г. Ростов-на-Дону', '046015602', '40802810452070012345', '30101810600000000602');

INSERT OR IGNORE INTO clients (id, user_id, name, phone, email, address, notes, client_type,
  company_name, inn, kpp, legal_address, contact_person, bank_name, bank_bik, bank_account, bank_corr_account) VALUES
  (3, 1, 'ООО "Гранд Отель"', '+7 (863) 777-88-99', 'hotel@grand.ru', 'г. Ростов-на-Дону, ул. Большая Садовая, д. 1',
   'Корпоративный клиент, оформление номеров', 'company',
   'ООО "Гранд Отель"', '6163098765', '616301001', 'г. Ростов-на-Дону, ул. Большая Садовая, д. 1',
   'Козлова Елена Владимировна', 'АО "АЛЬФА-БАНК" г. Ростов-на-Дону', '046015207', '40702810526000054321', '30101810500000000207');

-- Projects
INSERT OR IGNORE INTO projects (id, user_id, client_id, title, room, status, total_amount, notes) VALUES
  (1, 1, 1, 'Шторы в гостиную', 'Гостиная', 'sewing', 89500, '3 окна, римские шторы + портьеры'),
  (2, 1, 2, 'Комплект для офиса', 'Кабинет', 'design', 0, 'Блэкаут + тюль, 2 окна'),
  (3, 1, 3, 'Оформление номеров', 'Номер Люкс', 'new', 0, '5 номеров, рулонные шторы + портьеры');

-- Project items for project 1
INSERT OR IGNORE INTO project_items (project_id, fabric_id, description, quantity, unit, price, amount) VALUES
  (1, 1, 'Бархат "Версаль" — портьеры', 8.5, 'м', 1850, 15725),
  (1, 5, 'Органза с вышивкой — тюль', 12, 'м', 1200, 14400),
  (1, NULL, 'Пошив портьер', 3, 'шт', 8500, 25500),
  (1, NULL, 'Пошив тюля', 3, 'шт', 4500, 13500),
  (1, NULL, 'Карнизы + монтаж', 3, 'шт', 6125, 18375),
  (1, NULL, 'Выезд на замер', 1, 'шт', 2000, 2000);
