const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ===== MIDDLEWARES =====
app.use(express.json());
app.use(express.static('public')); // Serve o front-end

app.use(session({
    secret: 'chave_super_secreta_educonnect',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 dia
}));

// ===== BANCO DE DADOS SIMPLES (JSON) =====
const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Se o arquivo não existir, cria um padrão
        const defaultDB = { users: [] };
        writeDB(defaultDB);
        return defaultDB;
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ===== LISTA DE CURSOS (fixa) =====
const COURSES = [
    { id: 1, title: 'JavaScript do Zero ao Avançado', description: 'Domine JS, ES6+, Promises, Async/Await.', level: 'Intermediário', icon: '📜', students: '2.4k' },
    { id: 2, title: 'UI/UX Design para Iniciantes', description: 'Aprenda Figma, prototipação e princípios de design.', level: 'Iniciante', icon: '🎨', students: '1.8k' },
    { id: 3, title: 'Python para Análise de Dados', description: 'Pandas, NumPy, Matplotlib e dashboards.', level: 'Avançado', icon: '🐍', students: '3.1k' },
    { id: 4, title: 'React + Next.js Completo', description: 'Aplicações modernas com o ecossistema React.', level: 'Intermediário', icon: '⚛️', students: '980' },
    { id: 5, title: 'Banco de Dados SQL', description: 'Modelagem, consultas, joins e otimização.', level: 'Iniciante', icon: '🗄️', students: '1.2k' },
    { id: 6, title: 'Marketing Digital 360', description: 'SEO, tráfego pago, redes sociais e copywriting.', level: 'Intermediário', icon: '📈', students: '4.5k' }
];

// ============================================
// ===== ROTAS DA API =====
// ============================================

// ----- GET /api/courses -----
app.get('/api/courses', (req, res) => {
    res.json(COURSES);
});

// ----- POST /api/register -----
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 4) {
        return res.status(400).json({ error: 'Dados inválidos. Senha deve ter no mínimo 4 caracteres.' });
    }

    const db = readDB();
    if (db.users.find(u => u.email === email)) {
        return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password, // Em produção, você usaria bcrypt para hash
        enrolled: []
    };

    db.users.push(newUser);
    writeDB(db);

    // Remove a senha antes de enviar ao front
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
});

// ----- POST /api/login -----
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const db = readDB();
    const user = db.users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    // Salva o usuário na sessão (menos a senha)
    const { password: _, ...userSafe } = user;
    req.session.user = userSafe;
    res.json(userSafe);
});

// ----- GET /api/me -----
app.get('/api/me', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
    // Busca dados atualizados no banco
    const db = readDB();
    const user = db.users.find(u => u.id === req.session.user.id);
    if (!user) {
        req.session.destroy();
        return res.status(401).json({ error: 'Usuário não encontrado.' });
    }
    const { password: _, ...userSafe } = user;
    req.session.user = userSafe; // Atualiza sessão com dados frescos
    res.json(userSafe);
});

// ----- POST /api/logout -----
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Erro ao sair.' });
        res.json({ message: 'Logout realizado com sucesso.' });
    });
});

// ----- POST /api/enroll -----
app.post('/api/enroll', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Faça login primeiro.' });
    }

    const { courseId } = req.body;
    if (!courseId) {
        return res.status(400).json({ error: 'ID do curso é obrigatório.' });
    }

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.session.user.id);
    if (userIndex === -1) {
        req.session.destroy();
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const user = db.users[userIndex];
    if (!user.enrolled) user.enrolled = [];

    if (!user.enrolled.includes(courseId)) {
        user.enrolled.push(courseId);
        writeDB(db);
    }

    const { password: _, ...userSafe } = user;
    req.session.user = userSafe;
    res.json(userSafe);
});

// ===== INICIA O SERVIDOR =====
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📚 Acesse a plataforma em http://localhost:${PORT}`);
});
