const sql = require("../lib/db");
const {
    VALID_TYPES,
    VALID_CATEGORIES,
    VALID_MEMBERS,
    corsHeaders,
} = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    const { id } = req.query;

    try {
        // GET /api/transactions ou /api/transactions?id=X
        if (req.method === "GET") {
            if (id) {
                const rows = await sql.query(
                    `SELECT t.id, t.type, t.category, t.description, t.amount::float, t.date::text, t.member, t.tags, t.account_id, a.name as account_name, a.icon as account_icon, t.is_recurring, t.recurrence, t.created_at, t.updated_at
           FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id WHERE t.id = $1`,
                    [id],
                );
                if (!rows.length)
                    return res
                        .status(404)
                        .json({ error: "Transação não encontrada" });
                return res.json(rows[0]);
            }

            const {
                type,
                category,
                month,
                from,
                to,
                sort,
                search,
                member,
                tag,
                account_id: qAccountId,
            } = req.query;
            const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
            const offset = parseInt(req.query.offset) || 0;

            const conditions = [];
            const params = [];
            let paramIdx = 1;

            if (type && VALID_TYPES.includes(type)) {
                conditions.push(`t.type = $${paramIdx++}`);
                params.push(type);
            }
            if (category && VALID_CATEGORIES.includes(category)) {
                conditions.push(`t.category = $${paramIdx++}`);
                params.push(category);
            }
            if (month && /^\d{4}-\d{2}$/.test(month)) {
                conditions.push(
                    `date_trunc('month', t.date) = $${paramIdx++}::date`,
                );
                params.push(`${month}-01`);
            }
            if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
                conditions.push(`t.date >= $${paramIdx++}::date`);
                params.push(from);
            }
            if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
                conditions.push(`t.date <= $${paramIdx++}::date`);
                params.push(to);
            }
            if (search && search.trim()) {
                conditions.push(`t.description ILIKE $${paramIdx++}`);
                params.push(`%${search.trim()}%`);
            }
            if (member && VALID_MEMBERS.includes(member)) {
                conditions.push(`t.member = $${paramIdx++}`);
                params.push(member);
            }
            if (tag && tag.trim()) {
                conditions.push(`$${paramIdx++} = ANY(t.tags)`);
                params.push(tag.trim());
            }
            if (qAccountId && /^\d+$/.test(qAccountId)) {
                conditions.push(`t.account_id = $${paramIdx++}`);
                params.push(parseInt(qAccountId));
            }

            const where = conditions.length
                ? `WHERE ${conditions.join(" AND ")}`
                : "";
            const orderDir = sort === "asc" ? "ASC" : "DESC";

            const rows = await sql.query(
                `SELECT t.id, t.type, t.category, t.description, t.amount::float, t.date::text, t.member, t.tags, t.account_id, a.name as account_name, a.icon as account_icon, t.is_recurring, t.recurrence, t.created_at, t.updated_at
         FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id ${where}
         ORDER BY t.date ${orderDir}, t.id DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
                [...params, limit, offset],
            );
            return res.json(rows);
        }

        // POST /api/transactions
        if (req.method === "POST") {
            const {
                type,
                category,
                amount,
                description,
                date,
                member,
                tags,
                account_id,
                is_recurring,
                recurrence,
            } = req.body;

            if (!type || !VALID_TYPES.includes(type)) {
                return res.status(400).json({
                    error: `type deve ser: ${VALID_TYPES.join(", ")}`,
                });
            }
            if (!category || !VALID_CATEGORIES.includes(category)) {
                return res.status(400).json({
                    error: `category deve ser: ${VALID_CATEGORIES.join(", ")}`,
                });
            }
            const numAmount = parseFloat(amount);
            if (!numAmount || numAmount <= 0) {
                return res
                    .status(400)
                    .json({ error: "amount deve ser um número positivo" });
            }
            const txMember =
                member && VALID_MEMBERS.includes(member) ? member : "Eu";
            const txTags = Array.isArray(tags)
                ? tags.map((t) => String(t).trim()).filter(Boolean)
                : [];
            const txAccountId = account_id ? parseInt(account_id) : null;
            const txRecurring = is_recurring === true;
            const txRecurrence = ["weekly", "monthly", "yearly"].includes(
                recurrence,
            )
                ? recurrence
                : null;

            const rows = await sql.query(
                `INSERT INTO transactions (type, category, description, amount, date, member, tags, account_id, is_recurring, recurrence)
         VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7, $8, $9, $10)
         RETURNING id, type, category, description, amount::float, date::text, member, tags, account_id, is_recurring, recurrence, created_at, updated_at`,
                [
                    type,
                    category,
                    description || "",
                    numAmount,
                    date || null,
                    txMember,
                    txTags,
                    txAccountId,
                    txRecurring,
                    txRecurrence,
                ],
            );

            // Auto-create alerts when goals hit 80% or 100%
            if (type === "expense") {
                try {
                    const goals = await sql.query(
                        `SELECT category, monthly_limit::float FROM goals WHERE category = $1`,
                        [category],
                    );
                    if (goals.length) {
                        const goal = goals[0];
                        const now = new Date();
                        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                        const spent = await sql.query(
                            `SELECT COALESCE(SUM(amount), 0)::float as total FROM transactions
                             WHERE type = 'expense' AND category = $1 AND to_char(date, 'YYYY-MM') = $2`,
                            [category, monthStr],
                        );
                        const total = spent[0].total;
                        const pct = (total / goal.monthly_limit) * 100;
                        if (pct >= 100) {
                            await sql.query(
                                `INSERT INTO alerts (type, message, data) VALUES ($1, $2, $3)`,
                                [
                                    "danger",
                                    `Meta de ${category} estourada! ${Math.round(pct)}% do limite usado.`,
                                    JSON.stringify({
                                        category,
                                        pct: Math.round(pct),
                                        limit: goal.monthly_limit,
                                        spent: total,
                                    }),
                                ],
                            );
                        } else if (pct >= 80) {
                            await sql.query(
                                `INSERT INTO alerts (type, message, data) VALUES ($1, $2, $3)`,
                                [
                                    "warning",
                                    `Meta de ${category} em ${Math.round(pct)}% do limite.`,
                                    JSON.stringify({
                                        category,
                                        pct: Math.round(pct),
                                        limit: goal.monthly_limit,
                                        spent: total,
                                    }),
                                ],
                            );
                        }
                    }
                } catch (alertErr) {
                    console.error("alert auto-create error:", alertErr);
                }
            }

            return res.status(201).json(rows[0]);
        }

        // PUT /api/transactions?id=X
        if (req.method === "PUT") {
            if (!id) return res.status(400).json({ error: "id é obrigatório" });

            const {
                type,
                category,
                amount,
                description,
                date,
                member,
                tags,
                account_id,
                is_recurring,
                recurrence,
            } = req.body;
            const sets = [];
            const params = [];
            let paramIdx = 1;

            if (type !== undefined) {
                if (!VALID_TYPES.includes(type))
                    return res.status(400).json({ error: "type inválido" });
                sets.push(`type = $${paramIdx++}`);
                params.push(type);
            }
            if (category !== undefined) {
                if (!VALID_CATEGORIES.includes(category))
                    return res.status(400).json({ error: "category inválida" });
                sets.push(`category = $${paramIdx++}`);
                params.push(category);
            }
            if (amount !== undefined) {
                const num = parseFloat(amount);
                if (!num || num <= 0)
                    return res.status(400).json({ error: "amount inválido" });
                sets.push(`amount = $${paramIdx++}`);
                params.push(num);
            }
            if (description !== undefined) {
                sets.push(`description = $${paramIdx++}`);
                params.push(description);
            }
            if (date !== undefined) {
                sets.push(`date = $${paramIdx++}::date`);
                params.push(date);
            }
            if (member !== undefined) {
                if (!VALID_MEMBERS.includes(member))
                    return res.status(400).json({ error: "member inválido" });
                sets.push(`member = $${paramIdx++}`);
                params.push(member);
            }
            if (tags !== undefined) {
                const txTags = Array.isArray(tags)
                    ? tags.map((t) => String(t).trim()).filter(Boolean)
                    : [];
                sets.push(`tags = $${paramIdx++}`);
                params.push(txTags);
            }
            if (account_id !== undefined) {
                sets.push(`account_id = $${paramIdx++}`);
                params.push(account_id ? parseInt(account_id) : null);
            }
            if (is_recurring !== undefined) {
                sets.push(`is_recurring = $${paramIdx++}`);
                params.push(is_recurring === true);
            }
            if (recurrence !== undefined) {
                const validRec = ["weekly", "monthly", "yearly"].includes(
                    recurrence,
                )
                    ? recurrence
                    : null;
                sets.push(`recurrence = $${paramIdx++}`);
                params.push(validRec);
            }

            if (!sets.length)
                return res
                    .status(400)
                    .json({ error: "Nenhum campo para atualizar" });

            sets.push(`updated_at = NOW()`);
            params.push(id);

            const rows = await sql.query(
                `UPDATE transactions SET ${sets.join(", ")} WHERE id = $${paramIdx}
         RETURNING id, type, category, description, amount::float, date::text, member, tags, account_id, is_recurring, recurrence, created_at, updated_at`,
                params,
            );
            if (!rows.length)
                return res
                    .status(404)
                    .json({ error: "Transação não encontrada" });
            return res.json(rows[0]);
        }

        // DELETE /api/transactions?id=X
        if (req.method === "DELETE") {
            if (!id) return res.status(400).json({ error: "id é obrigatório" });

            const rows = await sql.query(
                "DELETE FROM transactions WHERE id = $1 RETURNING id",
                [id],
            );
            if (!rows.length)
                return res
                    .status(404)
                    .json({ error: "Transação não encontrada" });
            return res.json({ deleted: true, id: rows[0].id });
        }

        res.status(405).json({ error: "Método não permitido" });
    } catch (err) {
        console.error("transactions error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
