const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../src/db'); // Ajusta esta ruta si tu archivo db.js está en otra ubicación

// Ruta para registrar un nuevo usuario
router.post('/register', async (req, res) => {
    const { cedula, nombre, apellido, correo, password } = req.body;

    try {
        // 1. Validar que no falten campos obligatorios
        if (!cedula || !nombre || !apellido || !correo || !password) {
            return res.status(400).json({ error: "Todos los campos son obligatorios" });
        }

        // 2. Encriptar la contraseña de forma segura con bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Guardar en la base de datos protegiendo contra SQL Injection
        const query = `
            INSERT INTO usuarios (cedula, nombre, apellido, correo, password) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING id, cedula, nombre, apellido, correo, fecha_registro;
        `;
        
        const values = [cedula, nombre, apellido, correo, hashedPassword];
        const newUser = await pool.query(query, values);

        // 4. Responder con éxito (¡la contraseña nunca se devuelve!)
        res.status(201).json({
            message: "¡Usuario registrado con éxito!",
            usuario: newUser.rows[0]
        });

    } catch (err) {
        console.error(err);
        // Si el correo o la cédula ya existen en la base de datos
        if (err.code === '23505') {
            return res.status(400).json({ error: "El correo o la cédula ya se encuentran registrados." });
        }
        res.status(500).json({ error: "Error interno del servidor al registrar el usuario" });
    }
});

// Ruta para iniciar sesión
router.post('/login', async (req, res) => {
    const { correo, password } = req.body;

    try {
        // 1. Validar que no falten campos obligatorios
        if (!correo || !password) {
            return res.status(400).json({ error: "El correo y la contraseña son obligatorios" });
        }

        // 2. Buscar al usuario en la base de datos por su correo
        const query = 'SELECT * FROM usuarios WHERE correo = $1';
        const result = await pool.query(query, [correo]);

        // Si no encuentra el correo
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Correo o contraseña incorrectos" });
        }

        const usuario = result.rows[0];

        // 3. Comparar la contraseña escrita con la contraseña encriptada en PostgreSQL usando bcrypt
        const isPasswordValid = await bcrypt.compare(password, usuario.password);

        // Si la contraseña no coincide
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Correo o contraseña incorrectos" });
        }

        // 4. Si todo es correcto, eliminamos la contraseña del objeto antes de enviarlo por seguridad
        const { password: _, ...usuarioSinPassword } = usuario;

        // Responder con éxito
        res.status(200).json({
            message: "¡Inicio de sesión exitoso!",
            usuario: usuarioSinPassword
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error interno del servidor al iniciar sesión" });
    }
});

module.exports = router;