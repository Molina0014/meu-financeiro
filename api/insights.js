const sql = require("../lib/db");
const { corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    try {
        // GET /api/insights?month=YYYY-MM — structured data for AI
        if (req.method === "GET") {
            const month = req.query.month || new Date().toISOString().slice(0, 7);
            if (!/^\d{4}-\d{2}$/.test(month)) {
                return res.status(400).json({ error: "month deve ser YYYY-MM" });
            }

            // Current month expenses by category
            const byCategory = await sql.query(
                `SELECT category, SUM(amount)::float as total, COUNT(*)::int as count
                 FROM transactions
                 WHERE type = 'expense' AND to_char(date, 'YYYY-MM') = $1
                 GROUP BY category ORDER BY total DESC`,
                [month],
            );

            // Current month totals
            const totals = await sql.query(
                `SELECT type, SUM(amount)::float as total
                 FROM transactions
                 WHERE to_char(date, 'YYYY-MM') = $1
                 GROUP BY type`,
                [month],
            );

            const income = (totals.find((t) => t.type === "income") || {}).total || 0;
            const expenses = (totals.find((t) => t.type === "expense") || {}).total || 0;

            // Previous month totals for comparison
            const [y, m] = month.split("-").map(Number);
            const prevDate = new Date(y, m - 2, 1);
            const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

            const prevByCategory = await sql.query(
                `SELECT category, SUM(amount)::float as total
                 FROM transactions
                 WHERE type = 'expense' AND to_char(date, 'YYYY-MM') = $1
                 GROUP BY category ORDER BY total DESC`,
                [prevMonth],
            );

            const prevTotals = await sql.query(
                `SELECT type, SUM(amount)::float as total
                 FROM transactions
                 WHERE to_char(date, 'YYYY-MM') = $1
                 GROUP BY type`,
                [prevMonth],
            );

            const prevIncome = (prevTotals.find((t) => t.type === "income") || {}).total || 0;
            const prevExpenses = (prevTotals.find((t) => t.type === "expense") || {}).total || 0;

            // Top 3 categories that grew the most
            const prevMap = {};
            prevByCategory.forEach((c) => { prevMap[c.category] = c.total; });
            const categoryGrowth = byCategory.map((c) => ({
                category: c.category,
                current: c.total,
                previous: prevMap[c.category] || 0,
                growth: prevMap[c.category] ? ((c.total - prevMap[c.category]) / prevMap[c.category] * 100) : null,
            })).filter((c) => c.growth !== null && c.growth > 0).sort((a, b) => b.growth - a.growth).slice(0, 3);

            // Goals status
            const goals = await sql.query(
                `SELECT g.category, g.monthly_limit::float,
                        COALESCE((SELECT SUM(amount)::float FROM transactions WHERE type = 'expense' AND category = g.category AND to_char(date, 'YYYY-MM') = $1), 0) as spent
                 FROM goals g`,
                [month],
            );

            const goalsStatus = goals.map((g) => ({
                category: g.category,
                limit: g.monthly_limit,
                spent: g.spent,
                pct: Math.round((g.spent / g.monthly_limit) * 100),
            }));

            // Recurring transactions
            const recurring = await sql.query(
                `SELECT COUNT(*)::int as count, SUM(amount)::float as total
                 FROM transactions
                 WHERE is_recurring = true AND type = 'expense'`,
            );

            // Latest insight text (if any)
            const insightAlert = await sql.query(
                `SELECT message, created_at FROM alerts
                 WHERE type = 'insight' ORDER BY created_at DESC LIMIT 1`,
            );

            return res.json({
                month,
                income,
                expenses,
                balance: income - expenses,
                previousMonth: { month: prevMonth, income: prevIncome, expenses: prevExpenses },
                expenseVariation: prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses * 100).toFixed(1) : null,
                byCategory,
                categoryGrowth,
                goalsStatus,
                recurring: recurring[0] || { count: 0, total: 0 },
                latestInsight: insightAlert.length ? { text: insightAlert[0].message, date: insightAlert[0].created_at } : null,
            });
        }

        // POST /api/insights — save AI-generated text as insight alert
        if (req.method === "POST") {
            const apiKey = process.env.API_KEY;
            const provided = req.headers["x-api-key"];
            if (apiKey && provided !== apiKey) {
                return res.status(401).json({ error: "API key inválida" });
            }

            const { text, month } = req.body;
            if (!text) {
                return res.status(400).json({ error: "text é obrigatório" });
            }

            const rows = await sql.query(
                `INSERT INTO alerts (type, message, data)
                 VALUES ('insight', $1, $2)
                 RETURNING id, type, message, data, read, created_at`,
                [text, JSON.stringify({ month: month || new Date().toISOString().slice(0, 7) })],
            );

            return res.status(201).json(rows[0]);
        }

        res.status(405).json({ error: "Método não permitido" });
    } catch (err) {
        console.error("insights error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
