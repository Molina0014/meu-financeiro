const sql = require("../lib/db");
const { corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const month = req.query.month;
        let dateFilter;
        let params;

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            dateFilter = `date_trunc('month', date) = $1::date`;
            params = [`${month}-01`];
        } else {
            dateFilter = `date_trunc('month', date) = date_trunc('month', CURRENT_DATE)`;
            params = [];
        }

        const totals = await sql.query(
            `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::float AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::float AS expenses
       FROM transactions
       WHERE ${dateFilter}`,
            params,
        );

        const byCategory = await sql.query(
            `SELECT category, SUM(amount)::float AS total, COUNT(*)::int AS count
       FROM transactions
       WHERE type = 'expense' AND ${dateFilter}
       GROUP BY category
       ORDER BY total DESC`,
            params,
        );

        const { income, expenses } = totals[0];

        // Previous month calculation
        let prevDateFilter;
        let prevParams;
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const d = new Date(`${month}-01T00:00:00`);
            d.setMonth(d.getMonth() - 1);
            const prevMonth = d.toISOString().slice(0, 7);
            prevDateFilter = `date_trunc('month', date) = $1::date`;
            prevParams = [`${prevMonth}-01`];
        } else {
            prevDateFilter = `date_trunc('month', date) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')`;
            prevParams = [];
        }

        const prevTotals = await sql.query(
            `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::float AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::float AS expenses
       FROM transactions
       WHERE ${prevDateFilter}`,
            prevParams,
        );

        const prevIncome = prevTotals[0].income;
        const prevExpenses = prevTotals[0].expenses;
        const variation =
            prevExpenses > 0
                ? Math.round(((expenses - prevExpenses) / prevExpenses) * 100)
                : null;

        res.json({
            income,
            expenses,
            balance: income - expenses,
            byCategory,
            previousMonth: {
                income: prevIncome,
                expenses: prevExpenses,
                balance: prevIncome - prevExpenses,
            },
            variation,
        });
    } catch (err) {
        console.error("summary error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
