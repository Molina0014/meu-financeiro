const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
    console.log("Executando schema...");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
    await sql.query(schema);
    console.log("Schema aplicado com sucesso.");

    const shouldSeed = process.argv.includes("--seed");
    if (shouldSeed) {
        console.log("Inserindo dados de exemplo...");
        const seed = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf-8");
        await sql.query(seed);
        console.log("Dados de exemplo inseridos.");
    }

    console.log("Migração concluída.");
}

migrate().catch((err) => {
    console.error("Erro na migração:", err);
    process.exit(1);
});
