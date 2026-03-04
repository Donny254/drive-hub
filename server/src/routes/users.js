import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const toApi = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  createdAt: row.created_at,
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const result = await query("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC");
    res.json(result.rows.map(toApi));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, role } = req.body;
    const updates = [];
    const values = [];

    const maybeSet = (column, value) => {
      if (value !== undefined) {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      }
    };

    if (role && !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    maybeSet("name", name ?? undefined);
    if (role) {
      maybeSet("role", role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);

    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id, email, name, role, created_at`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(toApi(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const result = await query("DELETE FROM users WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
