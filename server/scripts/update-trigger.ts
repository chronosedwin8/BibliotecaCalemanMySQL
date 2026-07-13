import mysql from 'mysql2/promise';

const db = await mysql.createConnection({
  host: 'localhost', user: 'root', password: '1004',
  database: 'biblioteca', multipleStatements: true,
});

await db.query('DROP TRIGGER IF EXISTS trg_loan_checkout');
await db.query(`
CREATE TRIGGER trg_loan_checkout
AFTER INSERT ON loans
FOR EACH ROW
BEGIN
  IF @skip_loan_trigger IS NULL OR @skip_loan_trigger = 0 THEN
    UPDATE books SET cantidad_disponible = cantidad_disponible - 1 WHERE id = NEW.libro_id;
  END IF;
END
`);

console.log('✅ Trigger trg_loan_checkout actualizado con soporte @skip_loan_trigger');
await db.end();
