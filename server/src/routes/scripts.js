import { Router } from 'express';
import {
  createScript,
  deleteScript,
  getScriptById,
  initScriptStorageSchema,
  isScriptStorageConfigured,
  isScriptStorageReady,
  listScripts,
  updateScript,
  waitForOraclePool
} from '../db/oracle-scripts.js';

const router = Router();

function validateScriptPayload(body) {
  const errors = [];

  if (!body?.formData || typeof body.formData !== 'object') {
    errors.push('formData é obrigatório.');
  }

  if (!body?.generatedSql?.trim()) {
    errors.push('generatedSql é obrigatório.');
  }

  if (!body?.fileName?.trim()) {
    errors.push('fileName é obrigatório.');
  }

  const cardNumber = body?.formData?.cardNumber?.trim();
  if (!cardNumber) {
    errors.push('Número do card é obrigatório em formData.');
  }

  const scriptType = body?.formData?.scriptType?.trim();
  if (!scriptType) {
    errors.push('Tipo de script é obrigatório em formData.');
  }

  return errors;
}

async function ensureStorageReady(_req, res, next) {
  if (!isScriptStorageConfigured()) {
    return res.status(503).json({
      message:
        'Armazenamento indisponível. Configure ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECT_STRING.'
    });
  }

  try {
    await waitForOraclePool();
    await initScriptStorageSchema();
    next();
  } catch (error) {
    return res.status(503).json({
      message: error?.message ?? 'Oracle indisponível para armazenamento.'
    });
  }
}

router.get('/storage-status', async (_req, res) => {
  res.json({
    configured: isScriptStorageConfigured(),
    available: isScriptStorageConfigured() ? await isScriptStorageReady() : false
  });
});

router.get('/', ensureStorageReady, async (req, res) => {
  try {
    const scripts = await listScripts({
      cardNumber: req.query.cardNumber,
      scriptType: req.query.scriptType,
      q: req.query.q,
      limit: req.query.limit
    });
    res.json(scripts);
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao listar scripts.' });
  }
});

router.get('/:id', ensureStorageReady, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const script = await getScriptById(id);

    if (!script) {
      return res.status(404).json({ message: 'Script não encontrado.' });
    }

    res.json(script);
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao buscar script.' });
  }
});

router.post('/', ensureStorageReady, async (req, res) => {
  const errors = validateScriptPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(' ') });
  }

  try {
    const script = await createScript(req.body);
    res.status(201).json(script);
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao salvar script.' });
  }
});

router.put('/:id', ensureStorageReady, async (req, res) => {
  const errors = validateScriptPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(' ') });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const script = await updateScript(id, req.body);

    if (!script) {
      return res.status(404).json({ message: 'Script não encontrado.' });
    }

    res.json(script);
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao atualizar script.' });
  }
});

router.delete('/:id', ensureStorageReady, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'ID inválido.' });
  }

  try {
    const deleted = await deleteScript(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Script não encontrado.' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error?.message ?? 'Falha ao excluir script.' });
  }
});

export default router;
