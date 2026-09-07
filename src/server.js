const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');

// Importar las rutas de usuarios
const userRoutes = require('../Routes/userRoutes'); // Asegúrate de que apunte bien a tu carpeta routes

const app = express();

app.use(cors());
app.use(express.json());

// Usar las rutas de usuarios con el prefijo /api/usuarios
app.use('/api/usuarios', userRoutes);

// --- RUTA DE HORARIOS DE RECOLECCIÓN ---
app.get('/api/horarios', async (req, res) => {
    try {
        const query = 'SELECT * FROM horarios_recoleccion WHERE activo = true ORDER BY id ASC';
        const resultado = await pool.query(query);
        
        res.json({
            success: true,
            horarios: resultado.rows
        });
    } catch (error) {
        console.error("Error al obtener horarios:", error);
        res.status(500).json({ success: false, error: "Error en el servidor al consultar horarios" });
    }
});

// --- RUTA PARA REGISTRAR RECORDATORIOS ---
app.post('/api/recordatorios', async (req, res) => {
    const { correo, barrio } = req.body;

    if (!correo) {
        return res.status(400).json({ success: false, error: 'El correo es obligatorio' });
    }

    try {
        const query = `
            INSERT INTO recordatorios (correo, barrio, activo)
            VALUES ($1, $2, true)
            ON CONFLICT (correo) 
            DO UPDATE SET barrio = EXCLUDED.barrio, activo = true;
        `;
        const values = [correo, barrio || 'Samarkanda, Funza'];
        
        await pool.query(query, values);

        res.json({ 
            success: true, 
            message: '¡Te avisaremos antes de cada recolección!' 
        });
    } catch (error) {
        console.error("Error al guardar recordatorio:", error);
        res.status(500).json({ success: false, error: "Error en el servidor al guardar el recordatorio" });
    }
});

app.get('/', (req, res) => {
    res.json({ message: "¡Servidor de EcoRecolecta conectado con éxito!" });
});

app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            message: "¡Conexión a PostgreSQL exitosa!", 
            fecha_servidor: result.rows[0].now 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al conectar con la base de datos" });
    }
});

const PORT = process.env.PORT || 4000;
// IMPORTANTE: Se añade "0.0.0.0" para permitir conexiones externas desde tu celular físico o emulador
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
