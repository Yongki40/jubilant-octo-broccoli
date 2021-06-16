const express = require("express");
const mysql = require("mysql");
const app = express();

const db = require("./Database");
app.use(express.urlencoded({extended:true}));

const genAPIKey = (length) => {
    const alphabets= 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ'.split('');
    let key= '';

    for (let i= 0; i<length; i++) {
        let hash= Math.floor(Math.random()*2)+1;
        let model= Math.floor(Math.random()*2)+1;
        let randAlpha= Math.floor(Math.random()*alphabets.length);
        
        if (hash === 1) {
            key+= Math.floor(Math.random()*length);
        } else {
            if (model === 1) key+= alphabets[randAlpha].toUpperCase();
            else key+= alphabets[randAlpha]; 
        }
    }

    return key;
};

app.post('/api/users',async (req, res) => {
    let {email,nama_user,tanggal_lahir} = req.body;
    let query = `SELECT * FROM users WHERE email = '${email}'`;
    let user = await db.executeQuery(query);
    if(user.length != 0) {
        return res.status(401).send({
            error: 'sudah ada user dengan email tersebut'
        })
    }

    let umur = 2021 - parseInt(tanggal_lahir.split('-')[2]);
    if(umur < 13){
        return res.status(401).send({
            error: 'umur tidak mencukupi'
        })
    }
    let api_key = genAPIKey(15);
    query = `INSERT INTO users VALUES(?,?,?,?,?,?)`;
    let tanggal = tanggal_lahir.toString().split('-')[2] + '-' + tanggal_lahir.toString().split('-')[1] + '-'
    + tanggal_lahir.toString().split('-')[0];

    let formatTanggal = tanggal_lahir.toString().replace('-','/').replace('-','/').replace('-','/');

    await db.executeQueryWithParam(query,[email,nama_user,tanggal,0,0,api_key]);
    return res.status(201).send({
        email,
        nama_user,
        tanggal_lahir: formatTanggal,
        saldo: 0,
        api_hit:0,
        api_key
    })
});

app.post('/api/users/topup',async (req, res) => {
    const api_key = req.header('x-auth-token');

    let query = `SELECT * FROM users WHERE api_key = '${api_key}'`;
    let user = await db.executeQuery(query);

    if(!api_key){
        return res.status(401).send({
            error: 'api key kosong'
        })
    }

    if(user.length == 0){
        return res.status(404).send({
            error: 'api key tidak ditemukan'
        })
    }

    let {saldo} = req.body;

    if(!/^[0-9]*$/.test(saldo)){
        //cek hanya angka
        return res.status(401).send({
            error: 'saldo hanya boleh angka saja'
        })
    }

    query = `UPDATE users SET saldo = saldo + ${saldo} WHERE api_key = '${api_key}'`;
    await db.executeQuery(query);

    return res.status(200).send({
        email: user[0].email,
        saldo_awal: user[0].saldo,
        saldo_akhir: parseInt(user[0].saldo) + parseInt(saldo),
    })

});

app.put('/api/users/recharge',async (req, res) => {
    const api_key = req.header('x-auth-token');

    let query = `SELECT * FROM users WHERE api_key = '${api_key}'`;
    let user = await db.executeQuery(query);

    if(!api_key){
        return res.status(401).send({
            error: 'api key kosong'
        })
    }

    if(user.length == 0){
        return res.status(404).send({
            error: 'api key tidak ditemukan'
        })
    }

    if(user[0].saldo < 10000){
        return res.status(401).send({
            error: 'saldo tidak mencukupi'
        })
    }

    query = `UPDATE users SET saldo = saldo - 10000 WHERE api_key = '${api_key}'`;
    await db.executeQuery(query);

    query = `UPDATE users SET api_hit = api_hit +5 WHERE api_key = '${api_key}'`;
    await db.executeQuery(query);

    return res.status(200).send({
        email: user[0].email,
        api_hit_awal: user[0].api_hit,
        api_hit_akhir: parseInt(user[0].api_hit) + 5,
    })
});

app.post('/api/informations',async (req, res) => {
    const api_key = req.header('x-auth-token');

    let query = `SELECT * FROM users WHERE api_key = '${api_key}'`;
    let user = await db.executeQuery(query);

    if(!api_key){
        return res.status(401).send({
            error: 'api key kosong'
        })
    }

    if(user.length == 0){
        return res.status(404).send({
            error: 'api key tidak ditemukan'
        })
    }

    let {nama_tempat, kota, deskripsi, kategori} = req.body;
    if(kategori <0 || kategori >=3){
        return res.status(401).send({
            error: 'tidak ada kategori tersebut'
        })
    }

    query = `INSERT INTO tempat_wisata VALUES(?,?,?,?,?)`;
    let data = await db.executeQueryWithParam(query,['',nama_tempat, kota, deskripsi, kategori]);

    let formatKate = '';
    if(kategori == 0) formatKate = 'ruang terbuka';
    else if(kategori == 1) formatKate = 'taman bermain';
    else if(kategori == 2) formatKate = 'bangunan bersejarah';

    return res.status(201).send({
        kode: data.insertId,
        nama_tempat, kota, deskripsi,
        kategori: formatKate
    })
});

app.get('/api/informations',async (req, res) => {
    const api_key = req.header('x-auth-token');

    let query = `SELECT * FROM users WHERE api_key = '${api_key}'`;
    let user = await db.executeQuery(query);

    let tempats = [];
    if(!api_key){
        return res.status(401).send({
            error: 'api key kosong'
        })
    }

    if(user.length == 0){
        return res.status(404).send({
            error: 'api key tidak ditemukan'
        })
    }

    if(!req.query.kota && !req.query.kategori){
        query = `SELECT * FROM tempat_wisata`;
        tempats = await getTempats(query,req,res);
    }

    let where = 'SELECT * FROM tempat_wisata WHERE ';
    if(req.query.kota && !req.query.kategori){
        let kota = req.query.kota;
        query = where + `kota LIKE '%${kota}%'`
        tempats = await getTempats(query,req,res);
    }
    else if(!req.query.kota && req.query.kategori){
        let kategori = req.query.kategori;
        query = where + `kategori LIKE '%${kategori}%'`
        tempats = await getTempats(query,req,res);
    }
    else if(req.query.kota && req.query.kategori){
        let kategori = req.query.kategori;
        let kota = req.query.kota;
        query = where + `kategori LIKE '%${kategori}%' AND kota LIKE '%${kota}%'`
        tempats = await getTempats(query,req,res);
    }
    
    return res.status(200).send(tempats);
});

async function getTempats(query,req,res){
    let tempats = await db.executeQuery(query);
    for (let i = 0; i < tempats.length; i++) {
        const tempat = tempats[i];
        if(tempat.kategori == 0) tempat.kategori = 'ruang terbuka';
        else if(tempat.kategori == 1) tempat.kategori = 'taman bermain';
        else if(tempat.kategori == 2) tempat.kategori = 'bangunan bersejarah';
    }
    return tempats;
}

app.get('/api/informations/:kode_info',async (req, res) => {

});


app.listen(3000,() => console.log('listening on port 3000'));