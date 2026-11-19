const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const pool = require('../src/db');

// Configuración del servicio de correo (Gmail con Contraseña de Aplicación)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Ruta para registrar un nuevo usuario
router.post('/register', async (req, res) => {
    const { cedula, nombre, apellido, correo, password } = req.body;

    try {
        if (!cedula || !nombre || !apellido || !correo || !password) {
            return res.status(400).json({ error: "Todos los campos son obligatorios" });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO usuarios (cedula, nombre, apellido, correo, password) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING id, cedula, nombre, apellido, correo, fecha_registro;
        `;
        
        const values = [cedula, nombre, apellido, correo, hashedPassword];
        const newUser = await pool.query(query, values);

        res.status(201).json({
            message: "¡Usuario registrado con éxito!",
            usuario: newUser.rows[0]
        });

    } catch (err) {
        console.error(err);
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
        if (!correo || !password) {
            return res.status(400).json({ error: "El correo y la contraseña son obligatorios" });
        }

        const query = 'SELECT * FROM usuarios WHERE correo = $1';
        const result = await pool.query(query, [correo]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Correo o contraseña incorrectos" });
        }

        const usuario = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, usuario.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Correo o contraseña incorrectos" });
        }

        const { password: _, ...usuarioSinPassword } = usuario;

        res.status(200).json({
            message: "¡Inicio de sesión exitoso!",
            usuario: usuarioSinPassword
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error interno del servidor al iniciar sesión" });
    }
});

// Ruta para recuperar clave (genera clave temporal, actualiza en PostgreSQL y envía correo)
router.post('/recuperar-clave', async (req, res) => {
    const { correo } = req.body;

    try {
        if (!correo) {
            return res.status(400).json({ error: "Ingresa un correo electrónico válido" });
        }

        // 1. Verificar si el correo existe en la tabla usuarios
        const result = await pool.query('SELECT id, nombre, correo FROM usuarios WHERE correo = $1', [correo]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Este correo no se encuentra registrado" });
        }

        const usuario = result.rows[0];

        // 2. Generar clave temporal (ej. Eco4829) y encriptarla con bcrypt
        const claveTemporal = 'Eco' + Math.floor(1000 + Math.random() * 9000);
        const hashedPassword = await bcrypt.hash(claveTemporal, 10);

        // 3. Actualizar la contraseña en PostgreSQL
        await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hashedPassword, usuario.id]);

        // 4. Enviar el correo al usuario
        await transporter.sendMail({
            from: `"EcoRecolecta Samarkanda" <${process.env.EMAIL_USER}>`,
            to: usuario.correo,
            subject: 'Recuperación de clave - EcoRecolecta',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
                    <h2 style="color: #2E7533; margin-bottom: 8px;">EcoRecolecta · Samarkanda</h2>
                    <p style="color: #333;">Hola <b>${usuario.nombre}</b>,</p>
                    <p style="color: #555;">Recibimos una solicitud para restablecer tu contraseña. Tu nueva clave temporal de acceso es:</p>
                    <div style="background-color: #f4f8f4; border: 1px dashed #2E7533; padding: 14px; text-align: center; border-radius: 8px; margin: 16px 0;">
                        <span style="font-size: 22px; font-weight: bold; color: #2E7533; letter-spacing: 2px;">${claveTemporal}</span>
                    </div>
                    <p style="color: #555; font-size: 13px;">Ingresa esta clave en la aplicación para iniciar sesión.</p>
                </div>
            `
        });

        res.status(200).json({
            message: "¡Te enviamos una clave temporal a tu correo!"
        });

    } catch (err) {
        console.error("Error en recuperar-clave:", err);
        res.status(500).json({ error: "No se pudo enviar el correo de recuperación" });
    }
});

module.exports = router;
