///TODO change the year in the link

const axios = require('axios');
const cheerio = require('cheerio');
const year = new Date().getFullYear() - 1;
const resultsDate = Date.parse('Jul 05 2021 12:00:00 GMT+0300');

const discord = require("discord.js");
const { before } = require('cheerio/lib/api/manipulation');
const { checkServerIdentity } = require('tls');
const bot = new discord.Client();

const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();

const beforeTimeout = 5 * 60 * 1000;
const afterTimeout = 1 * 60 * 1000;
const shortTimeout = 1 * 1 * 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchData(url,timeout){
    console.log("Crawling data...");
    // make http call to url
    while(true){
        let response = await axios(url).catch((err) => console.log(err));
        
        if(response.status !== 200){
            console.log("Error occurred while fetching data");
            await sleep(timeout);
            continue;
        }
        return response;
    }   
}

async function getDocument(url,timeout){
    res = await fetchData(url,timeout);
    const html = res.data;
    const document = cheerio.load(html);
    return document;
}

async function findPageRange(){
    let timeout = 0;
    if(Date.parse(new Date()) < resultsDate){
        timeout = beforeTimeout;
    }else{
        timeout = afterTimeout;
    }
    document = await getDocument(`http://static.bacalaureat.edu.ro/${year}/rapoarte/rezultate/alfabetic/page_1.html`,timeout);
    let firstPage = document('[class="opte"]')[0];
    let lastPage = document('[class="opte"]')[1];

    let firstString = firstPage.children[0].data;
    let lastString = lastPage.children[0].data;

    return {
            firstPage: parseInt(firstString.split(' ')[1]),
            lastPage: parseInt(lastString.split(' ')[1])
        };

}

async function getIdRange(page){
    document = await getDocument(`http://static.bacalaureat.edu.ro/${year}/rapoarte/rezultate/alfabetic/page_${page}.html`,shortTimeout);
    trList = document('#mainTable > tbody')[0];
    firstId = trList.children[2].attribs['hint'];
    lastId = trList.children[trList.children.length - 2].attribs['hint'];
    return {
        firstId:firstId.trim(),
        lastId:lastId.trim()
    };
}

async function findPageForId(id){
    pageRange = await findPageRange();
    firstPage = pageRange.firstPage;
    lastPage = pageRange.lastPage;


    let l = firstPage - 1;
    let r = lastPage + 1;

    while(r - l > 1){
        let mid = (l + r) >> 1;
        let firstId = (await getIdRange(mid)).firstId;
        if(firstId <= id){
            l = mid;
        }else{
            r = mid;
        }
    }

    if(l < firstPage - 1 || (await getIdRange(l)).lastId < l){
        return -1;
    }

    return l;
}

async function extractData(id){
    page = await findPageForId(id);
    if(page == -1){
        return {error:`no result found for ${id}`};
    }
    let timeout = 0;
    if(Date.parse(new Date()) < resultsDate){
        timeout = beforeTimeout;
    }else{
        timeout = afterTimeout;
    }
    document = await getDocument(`http://static.bacalaureat.edu.ro/${year}/rapoarte/rezultate/alfabetic/page_${page}.html`,timeout);
    rows = document(`[hint*=${id}]`);

    if(rows.length != 2){
        return {error:`no result found for ${id}`};
    }

    answer = {};

    try{
        answer.judetHierarchy = parseInt(rows[0].children[3].children[1].children[0].data.trim());
        answer.countryHierarchy = parseInt(rows[0].children[4].children[1].children[0].data.trim());
        answer.highSchool = rows[0].children[5].children[0].children[0].data.trim();
        answer.romanianSkillTest = rows[0].children[10].children[0].data.trim();
        answer.romanianInitialMark = rows[0].children[11].children[0].data.trim();
        answer.romanianFinalMark = rows[0].children[13].children[0].data.trim();
        answer.natalTongue = rows[0].children[14].children[0].data.trim();
        answer.modernTongue = rows[0].children[15].children[0].data.trim();
        answer.modernGrades = rows[0].children[16].children[0].data.trim();
        answer.mandatorySubject = rows[0].children[17].children[0].data.trim();
        answer.chooseSubject = rows[0].children[18].children[0].data.trim();
        answer.digitalSkillTest = rows[0].children[19].children[0].data.trim();

        answer.natalTongueSkillTest = rows[1].children[0].children[0].data.trim();
        answer.natalTongueInitialMark = rows[1].children[1].children[0].data.trim();
        answer.natalTongueFinalMark = rows[1].children[3].children[0].data.trim();
        answer.mandatorySubjectInitialMark = rows[1].children[4].children[0].data.trim();
        answer.mandatorySubjectFinalMark = rows[1].children[6].children[0].data.trim();
        answer.chooseSubjectInitialMark = rows[1].children[7].children[0].data.trim();
        answer.chooseSubjectFinalMark = rows[1].children[9].children[0].data.trim();

        if(answer.romanianFinalMark.trim() == ''){
            answer.romanianMark = parseFloat(answer.romanianInitialMark);
        }else{
            answer.romanianMark = parseFloat(answer.romanianFinalMark);
        }
        delete answer.romanianInitialMark;
        delete answer.romanianFinalMark;

        if(answer.natalTongueFinalMark.trim() == ''){
            answer.natalTongueMark = parseFloat(answer.natalTongueInitialMark);
        }else{
            answer.natalTongueMark = parseFloat(answer.natalTongueFinalMark);
        }
        delete answer.natalTongueInitialMark;
        delete answer.natalTongueFinalMark;

        if(answer.mandatorySubjectFinalMark.trim() == ''){
            answer.mandatorySubjectMark = parseFloat(answer.mandatorySubjectInitialMark);
        }else{
            answer.mandatorySubjectMark = parseFloat(answer.mandatorySubjectFinalMark);
        }
        delete answer.mandatorySubjectInitialMark;
        delete answer.mandatorySubjectFinalMark;

        if(answer.chooseSubjectFinalMark.trim() == ''){
            answer.chooseSubjectMark = parseFloat(answer.chooseSubjectInitialMark);
        }else{
            answer.chooseSubjectMark = parseFloat(answer.chooseSubjectFinalMark);
        }
        delete answer.chooseSubjectInitialMark;
        delete answer.chooseSubjectFinalMark;

    }catch(err){
        console.log(err);
        return {error:`corrupt data for id ${id}`};
    }

    let cnt = 3;
    let sum = answer.romanianMark + answer.mandatorySubjectMark + answer.chooseSubjectMark;

    if(isNaN(answer.natalTongueMark) == false){
        cnt++;
        sum += answer.natalTongueMark;
    }

    answer.score = sum / cnt;
    
    let ok = true;

    if(answer.romanianMark < 5){
        ok = false;
    }else if(answer.mandatorySubjectMark < 5){
        ok = false;
    }else if(answer.chooseSubjectMark < 5){
        ok = false;
    }else if(isNaN(answer.natalTongueMark) == false && answer.natalTongueMark < 5){
        ok = false;
    }else if(Math.round((answer.score + Number.EPSILON) * 100) / 100
    < 5.99){
        ok = false;
    }

    if(ok == true){
        answer.verdict = 'REUSIT';
    }else{
        answer.verdict = 'RESPINS';
    }

    return answer;
}

async function fetchUserData(user){
    let data = fs.readFileSync('users.csv', 'utf-8');
    if(data == ''){
        return undefined;
    }
    let lines = data.split('\n');
    for(let i = 0;i < lines.length;i++){
        if(lines[i].split(',')[0] == user){
            return {
                user:lines[i].split(',')[0],
                attempts:lines[i].split(',')[1]
            }
        }
    }
    return undefined;
}

async function writeUserData(userData){
    let data = fs.readFileSync('users.csv','utf-8');
    let lines = data.split('\n');
    let userLine = -1;
    for(let i = 0;i < lines.length;i++){
        let cols = lines[i].split(',');
        if(cols[0] == userData.user){
            userLine = i;
            break;
        }
    }
    let line = "";
    
    for(let i = 0;i < lines.length;i++){
        if(i == userLine || lines[i].trim() == "" || lines[i].trim() == "\n"){
            continue;
        }
        line += lines[i] + "\n";
    }

    fs.writeFileSync("users.csv", line);
    fs.appendFileSync("users.csv",`${userData.user},${userData.attempts}\n`);
}


async function writeUserInQueue(user,id){
    let data = fs.readFileSync('queue.csv','utf-8');
    let lines = data.split('\n');
    let userLine = -1;
    for(let i = 0;i < lines.length;i++){
        let cols = lines[i].split(',');
        if(cols[0] == userData.user){
            userLine = i;
            break;
        }
    }    
    let line = "";
    
    for(let i = 0;i < lines.length;i++){
        if(i == userLine || lines[i].trim() == "" || lines[i].trim() == "\n"){
            continue;
        }
        line += lines[i] + "\n";
    }
    fs.writeFileSync("queue.csv", line);
    fs.appendFileSync("queue.csv",`${user},${id}\n`);    
}

bot.on('ready', () =>{
    console.log(`${bot.user.username} e online`);
    bot.user.setActivity("Knock Knock");
});

bot.on('message',async (message) => {
    if(message.author.bot){
        return ;
    }

    function help(){
        bot.channels.cache.get(message.channel.id).send(
            `Acest bot a fost creat ca sa dea refreshuri in locul tau la pagina de bacalaureat, si sa iti spuna (eventual) notele\n
            Pentru asta, insa, trebuie sa ii specifici id-ul pe care l-ai avut la examen.
            De exemplu, ca sa iti adaugi id-ul tau, tot ce trebuie sa faci e sa scrii intr-un mesaj
            @Hermbac ID\n
            De asemenea, daca iti gresesti id-ul poti sa il trimiti din nou si botul va stii sa il schimbe pe cel vechi cu asta nou(poti face asta de maxim 3 ori)`
        );
    }

    async function checkId(user,id){

        userData = await fetchUserData(user);

        if(userData === undefined){
            userData = {user:user,attempts:0};
        }

        if(userData.attempts >= 3){
            return {error:"No attempts left"};
        }

        userData.attempts++;

        await writeUserData(userData);

        if(id.length < 4 || id.length > 20){
            return {error:"id length does not correspond to a valid id"};
        }
        
        for(let i = 0;i < id.length;i++){
            if((!('0' <= id[i] && id[i] <= '9')) && (!('A' <= id[i] && id[i] <= 'Z'))){
                return {error:"id contains illegal characters"};
            }
        }
        await writeUserInQueue(user,id);
        return {};
    }

    if(message.mentions.has(bot.user)){
        let user = message.author.id;
        let splitedMessage = message.content.split(' ');
        if(splitedMessage.length != 2){
            help();
            return ;
        }
        let id = splitedMessage[1];
        console.log(user,id);
        idCheck = await checkId(user,id);
        if(idCheck.error === undefined){
            message.reply('Am adaugat id-ul');
            return ;
        }else{
            message.reply(idCheck.error);
            return ;
        }
    }
});

async function createDatabase(){
    let queueFile = fs.openSync('queue.csv','w');
    //fs.writeSync(queueFile,"user,id\n");
    fs.closeSync(queueFile);
    let usersFile = fs.openSync('users.csv','w');
    //fs.writeSync(usersFile,"user,attempts\n");
    fs.closeSync(usersFile);
}

async function resolveQueue(){
    let data = fs.readFileSync('queue.csv','utf-8');
    if(data.trim() == '' || data.trim == '\n'){
        ///TODO change back to beforetimeout
        await sleep(shortTimeout);
        return ;
    }
    let user = data.split("\n")[0].split(',')[0];
    let id = data.split("\n")[0].split(',')[1];
    data = await extractData(id);

    let message = "";

    if(data.error === undefined){
        message = `
        ID: **${id}**
        Liceul: ${data.highSchool}
        Competente romana: ${data.romanianSkillTest}
        Nota romana: **${data.romanianMark}**
        Limba materna: ${data.natalTongue}
        Competente limba materna: ${data.natalTongueSkillTest}
        Nota limba materna: **${data.natalTongueMark}**
        Limba moderna: ${data.modernTongue}
        Note limba moderna: **${data.modernGrades}**
        Disciplina obligatoarie: ${data.mandatorySubject}
        Nota disciplina obligatorie: **${data.mandatorySubjectMark}**
        Disciplina la alegere: ${data.chooseSubject}
        Nota disciplina la alegere: **${data.chooseSubjectMark}**
        Competente digitale: ${data.digitalSkillTest}
        Nota finala: **${data.score}**
        Locul pe judet dupa medie: ${data.judetHierarchy}
        Locul pe tara dupa medie: ${data.countryHierarchy}
        Rezultatul final: **${data.verdict}**
        `
    }else{
        message = data.error;
    }

    bot.users.cache.get(user).send(message);

    data = fs.readFileSync('queue.csv','utf-8');
    let lines = data.split('\n');
    let line = "";
    
    for(let i = 0;i < lines.length;i++){
        if(i == 0 || lines[i].trim() == "" || lines[i].trim() == "\n"){
            continue;
        }
        line += lines[i] + "\n";
    }
    fs.writeFileSync("queue.csv", line);
}

async function main(){
    await createDatabase();
    await fetchUserData(20);
    bot.login(process.env.TOKEN);
    while(true){
        await resolveQueue();
    }
}

main();