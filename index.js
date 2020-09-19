const cheerio 		= 	require('cheerio');
const axios     	=	require('axios').default;
const fs 			= 	require('fs');
var pdfMake 		= 	require('pdfmake/build/pdfmake.js');
var pdfFonts 		= 	require('pdfmake/build/vfs_fonts.js');
pdfMake.vfs 		= 	pdfFonts.pdfMake.vfs;
const fse 			=	require('fs-extra');

const imageToBase64 =	require('image-to-base64');
const lineReader 	=	require('line-reader');


let listArtWorks		=	require('./fullInfo.json');
const commons			=	require('./commons.js');
const baseUrl 			=	'https://www.saatchiart.com';
const regexJustNumber	=	/\d+/g;

async function getUrl(url){
	const request	=	await axios.get(url);
    const html      = 	request.data;
    const $         = 	cheerio.load(html);
    return $;
}

/**
 * Get the main info from the user and return the mounted object
 * @param {name of the profile} profileUrl 
 */
async function getUserInfo(profileUrl){
	let $	=	await getUrl(profileUrl);
	console.log($('.ellipsis').find('i').attr().title);
	let socialMediaLinks	=	$('.profile-links.nav').find('ul').find('li').map((index,element)=>
																					{ return { 	plataforma 	:	$(element).find('a').attr().title,
																								link		:	$(element).find('a').attr().href
																							}
																					}
																				).get();

	return {
		avatar			:	"https:"+$('.profile-pic').find('img').attr().src											|| 'https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcRUfxQDFxR6MvsVFCtx3_bzLC68ZPza7KsvRg&usqp=CAU',
		usuari			:	String($('.ellipsis').text()).trim() 												|| '-',
		nacionalitat	:	$('.ellipsis').find('i').attr().title 												|| '-',
		following		:	$('.about-follow-nav').find('a').first().find('span').text() 						|| '-',
		followers		:	$('.about-follow-nav').find('a').last().find('span').text() 						|| '-',
		xarxesSocials	:	socialMediaLinks 																	|| [],
		linkObres		:	$('.aside-portfolio').find('h3').find('a').attr().href								|| '-',
		totalObres		:	$('.aside-portfolio').find('h3').find('a').text().trim().match(regexJustNumber).join("")		|| '-'	

	}
}

async function getArtistsFromCategory(categoryUrl,count){
	let $						=	await getUrl(categoryUrl);
	let countMainCategory		=	$('.w03luy-1.cygeUL').length;
	let countMainTagCategory	=	$('.sc-1j9gsx-1.eSRsWU').length;
	let linksArtistes			=	[];
	switch(true){
		case countMainCategory 		> 0 :  	linksArtistes	=	$('.sc-19rshfy-6.iAiSsx.d5x441-1.jDvrtz').map((index,artista) => $(artista).find('.d5x441-0.cfoXjx').last().find('a').attr().href).get(); break;
		case countMainTagCategory 	> 0 :	linksArtistes	=	$('.sc-19cosvr-6.kSyZle.d5x441-1.jDvrtz').map((index,artista) => $(artista).find('.d5x441-0.cfoXjx').last().find('a').attr().href).get(); break;
		default							:	return;
	}
	
	return linksArtistes.slice(0,count);	
}

async function getArtworksFromArtist(artworksUrl){
	let $				=	await getUrl(artworksUrl);
	let totalObres		=	$('.sc-193iw96-10.hjWoJG.sc-1ybxa11-0.fpvhcV').find('a').first().find('span').text().trim().match(regexJustNumber).join("");
	totalObres			=	totalObres > 150 ? 150 : totalObres;
	let iterations		=	!totalObres ? 1 : (Math.round(+totalObres/100) == 1 ? 2 : Math.round(+totalObres/100));
	iterations			=	iterations == 0 ? 1 : iterations;
	console.log('ITERACIONS', iterations);
	let obres			=	[];
	await Promise.all(Array.from(Array(iterations).keys()).map(async (el,currentPage) => {
		console.log('STEP',currentPage);
		if(currentPage !== 0){
			$	=	await getUrl(`${artworksUrl}/?page=${currentPage+1}`)
		}
		$('.sc-9pmg3r-1.kjPoiM.sc-1ypbzzj-2.htErej').each((index,element)=>{
			{
				const basePrice		=	$(element).find('.d5x441-0.cfoXjx').find('.d5x441-1.jDvrtz').last().find('p');
				const price			=	basePrice != null ? (basePrice.length > 1 ? basePrice.first().text() : 	basePrice.text()) : null
				const prints		=	basePrice != null ? (basePrice.length > 1 ? basePrice.last().text()	:	'-') : null;
				obres.push({
					id		:	$(element).find('a').attr().href.split('/')[$(element).find('a').attr().href.split('/').length - 2],
					url		:	$(element).find('a').attr().href,
					nom		:	$(element).find('.sc-1ybxa11-1.cSMQJj').find('h2 > a').text(),
					mides	:	calculateSizeArtWork($(element).find('.sc-1ybxa11-1.cSMQJj').find('h4').find('span').text()),
					venut	:	$(element).find('.sc-9pmg3r-6.kIWBnL.u1n5e7-0.iTNvvL').text() !== "",
					preu	:	basePrice != null ? (price[0] == "$" ? (getNumberFromString(price)*0.85).toFixed(2) : getNumberFromString(price)) : null,
					moneda	:	"€",	
					prints	:	(prints != "-" || prints != null) ? getNumberFromString(prints) : prints
				})
			}
		})
	}))
	console.log(obres.length);
	return obres;
}

async function getInfoFromArtwork(artworkUrl, id){
	let $				=	await getUrl(artworkUrl);
	const infoDetalls	=	$('.sc-1omy9oa-2.hqSRHb.q4fc1b-2.fQMcSU.mix161-1').find('.mix161-0.bhxZbk');
	const info	=	{
		artWorkId				:	id,
		descripcio				:	$('.sc-1omy9oa-2.hqSRHb.q4fc1b-2.fQMcSU.mix161-1.bCggZd').find('p').map((index,paragraph) => $(paragraph).text()).get().join(),
		tags					:	infoDetalls.eq(1).find('a').map((index,tag) => $(tag).text()).get(),
		subjects				:	infoDetalls.eq(2).find('a').text(),
		estils					:	infoDetalls.eq(3).find('.mix161-0.bhxZbk').find('a').map((index,style) 		=> $(style).text()).get(),
		tecnica					:	infoDetalls.eq(4).find('.mix161-0.bhxZbk').find('a').map((index,technic) 	=> $(technic).text()).get(),
		tipus					:	infoDetalls.eq(5).find('.mix161-0.bhxZbk').find('a').map((index,type) 		=> $(type).text()).get(),
		premis					:	$('.sc-1qj6nbm-0.hmczNM.q4fc1b-2.fQMcSU.mix161-1.bCggZd').find('div').map((index,prize) => $(prize).text()).get(),
	}
	return info;
}


function getNumberFromString(string){
	try{
		return string.match(regexJustNumber).join("");
	}catch(e){
		return null;
	}
}
function calculateSizeArtWork(info){
	const isInches	=	String(info).includes('in');
	const planned	=	String(info).replace(' ', '').split('x');
	const height	=	getNumberFromString(planned[0]);
	const width		=	getNumberFromString(planned[1]);
	const wide		=	getNumberFromString(planned[2]);
	return {
		altura		:	isInches ? (height*2.54) / 10 	:	height,
		llargaria	:	isInches ? (width*2.54) / 10	:	width,
		grossor		:	isInches ? (wide*2.54) / 10		:	wide	 
	}
}

async function getMetaInfoArtWorks(listArtWorks){
	const iterations	=	Math.round(listArtWorks.length / 10);
	let mergedInfo		=	[];
	let from			=	0;
	let to 				=	10;
	let currentIteration=	1;
	console.log(iterations, listArtWorks.length);
	while(currentIteration <= iterations){
		console.log('iteration, from, to: ', currentIteration, from, to );
		await Promise.all(listArtWorks.slice(from,to).map(async artWork => {
			let infoArtWork	=	await getInfoFromArtwork(`${baseUrl}${artWork.url}`,artWork.id);
			console.log(`adding artwork${artWork.id}`);
			mergedInfo.push({...artWork,...infoArtWork})
		}));
		currentIteration++;
		from+=10;
		to = to + 10 > listArtWorks.length ? to+=(listArtWorks.length-to) : to+=10;
	}
	return mergedInfo;
}

async function generatePdf(usuari, obres){
	let avatar	=	await imageToBase64(usuari.avatar);
	var dd = {
		content: [
			{
				alignment: 'center',
				columns: [
					{
						image: 'data:image/jpeg;base64,'+avatar,
						width: 120,
						height: 120
					},
					{
						style : 'tableExample',
						table : {
							widths: [125, 240],
							body : [
								['Nom', usuari.usuari],
								['Nacionalitat', usuari.nacionalitat],
								['Followers', usuari.followers],
								['Following', usuari.following],
								['Obres', usuari.totalObres],
								['Xarxes Socials', { ul : usuari.xarxesSocials.map(el => el.link), fontSize: 10, alignment: 'start'}],
							]
						}
					},
				]
			},
			{
				alignment: 'center',
				columns: [
					{
						style : 'tableExample',
						table : {
							widths: [100, 100],
							body : [
								['Mitja Preu', obres.infoGeneral.mitjanaPreu + "€"],
								['Total Venuts', obres.infoGeneral.venuts],
								['% Venuts', obres.infoGeneral.percentVenuts],
								['Mitja Preu Venuts', obres.infoGeneral.mitjanaPreuVenuts + "€"],
							]
						}
					},
					{
						style : 'tableExample',
						table : {
							widths: [100, 100],
							body : [
								['Altura Mitjana', obres.mesures.alturaMitjana 		+ " cm"],
								['Amplada Mitjana', obres.mesures.llargariaMitjana 	+ " cm"],
								['Grossor Mitjana', obres.mesures.gruixMitjana 		+ " cm"], 
								['Altura Mitjana Venuts', obres.mesures.alturaMitjanaVenuda 	+ " cm"],
								['Amplada Mitjana Venuts', obres.mesures.llargariaMitjanaVenuda + " cm"],
								['Grossor Mitjana Venuts', obres.mesures.gruixMitjanaVenuda 	+ " cm"]
							]
						}
					},

				]
			},
			{
				alignment : 'center',
				columns	: [
					{
						style : 'tableKeyWords',
						table : {
							widths: [80, 25],
							body : obres.keyWords.tags.map(el => [el.value,el.count])
						}	
					},
					{
						style : 'tableKeyWords',
						table : {
							widths: [80, 25],
							body : obres.keyWords.estils.map(el => [el.value,el.count])
						}	
					},
					{
						style : 'tableKeyWords',
						table : {
							widths: [80, 25],
							body : obres.keyWords.tematica.map(el => [el.value,el.count])
						}	
					},
					{
						style : 'tableKeyWords',
						table : {
							widths: [80, 25],
							body : obres.keyWords.tecnica.map(el => [el.value,el.count])
						}	
					},
					
				]
			}
		],
		styles: {
			header: {
				fontSize: 18,
				bold: true
			},
			subheader: {
				fontSize: 15,
				bold: true
			},
			quote: {
				italics: true
			},
			small: {
				fontSize: 8
			},
			tableExample: {
				margin: [10,0,10,10],
			},
			tableKeyWords: {
				margin: [5,5,5,5]
			}
		}
		
	}

	await generatePdfAndDir(dd,usuari);
	
}

async function generatePdfAndDir(dd,usuari){
	return new Promise((resolve,reject) => {
		pdfMake.createPdf(dd).getBuffer(function(buffer) {
			fse.outputFile('artistes/'+usuari.usuari+'.pdf', Buffer.from(new Uint8Array(buffer)))
						.then(() => {
							resolve()
						})
						.catch(err => {
							console.error(err);
							reject();
						});
			// fs.writeFileSync('.artistes/'+usuari.usuari+'.pdf', Buffer.from(new Uint8Array(buffer)));
		});
	})
	
}

function generateResummeArtist(usuari,listArtWorks){
	const soldArtWorks		=	listArtWorks.filter(el => el.venut);
		
	const avg				=	+(listArtWorks.filter(el => el.preu != null).reduce((sum,value)=>sum + +value.preu, 0) / listArtWorks.length).toFixed(2);
	const sold				=	soldArtWorks.length;
	const percentVenuts		=	(soldArtWorks.length / listArtWorks.length).toFixed(2);
	const priceAvgSold		=	+(soldArtWorks.reduce((sum,value) => sum + +value.preu, 0) / soldArtWorks.length).toFixed(2)
	
	const avgHeight			=	+(listArtWorks.reduce((sum,value)=> sum + +value.mides.altura,0) 	/ listArtWorks.length).toFixed(2);
	const avgWidth			=	+(listArtWorks.reduce((sum,value)=> sum + +value.mides.llargaria,0) / listArtWorks.length).toFixed(2);
	const avgWide			=	+(listArtWorks.reduce((sum,value)=> sum + +value.mides.grossor,0) 	/ listArtWorks.length).toFixed(2);
	
	const avgHeightSold		=	+(soldArtWorks.reduce((sum,value)=> sum + +value.mides.altura,0) 	/ soldArtWorks.length).toFixed(2);
	const avgWidthSold		=	+(soldArtWorks.reduce((sum,value)=> sum + +value.mides.llargaria,0)	/ soldArtWorks.length).toFixed(2);
	const avgWideSold		=	+(soldArtWorks.reduce((sum,value)=> sum + +value.mides.grossor,0) 	/ soldArtWorks.length).toFixed(2);

	console.log("****************************************************");

	console.log('Mitjana Preu:'				, avg+"€");
	console.log('Obres Venudes:'			, sold);
	console.log('Preu mitjà obres venudes: ', priceAvgSold + "€");

	console.log("****************************************************");

	console.log('Altura mitjana:'			, avgHeight	+" cm");
	console.log('Llargària mitjana:'		, avgWidth 	+" cm");
	console.log('Grossor mitjà:'			, avgWide 	+" cm");

	console.log("****************************************************");

	console.log('Altura mitjana venuda:'		, avgHeightSold +" cm");
	console.log('Llargària mitjana venuda:'		, avgWidthSold 	+" cm");
	console.log('Grossor mitjà venuda:'			, avgWideSold 	+" cm");

	console.log("****************************************************");

	let keyWordsAppareances	=	commons.getOccurrences(listArtWorks,'tags');
	keyWordsAppareances		=	keyWordsAppareances.slice(0,15);
	console.log('Tags més emprats són:')
	console.log(keyWordsAppareances.slice(0,15));

	console.log("****************************************************");

	let stylesAppareances	=	commons.getOccurrences(listArtWorks,'estils');
	stylesAppareances		=	stylesAppareances.slice(0,15);
	console.log('Estils més emprats són:')
	console.log(stylesAppareances.slice(0,15));

	console.log("****************************************************");

	let subjectsAppareances		=	commons.getOccurrences(listArtWorks,'subjects');
	subjectsAppareances			=	subjectsAppareances.slice(0,15);
	console.log('Temàtica més emprada és:')
	console.log(subjectsAppareances.slice(0,15));

	console.log("****************************************************");

	let technicAppareances		=	commons.getOccurrences(listArtWorks,'tipus') || [];
	technicAppareances			=	technicAppareances.slice(0,15)
	console.log('Tècnica més emprada és:')
	console.log(technicAppareances.slice(0,15));

	const resumme	=	{
		infoGeneral	:	{
			mitjanaPreu			:	avg,
			venuts				:	sold,
			percentVenuts		:	percentVenuts,
			mitjanaPreuVenuts	:	priceAvgSold,
		},
		mesures	:	{
			alturaMitjana			:	avgHeight,
			llargariaMitjana		:	avgWidth,
			gruixMitjana			:	avgWide,
			alturaMitjanaVenuda		:	avgHeightSold,
			llargariaMitjanaVenuda	:	avgWidthSold,
			gruixMitjanaVenuda		:	avgWideSold
		},
		keyWords	:	{
			tags		:	keyWordsAppareances,
			estils 		:	stylesAppareances,
			tematica	:	subjectsAppareances,
			tecnica		:	technicAppareances
		}
		
	}
	generatePdf(usuari,resumme);
}
function readFile(){
	let artists	=	[];
	var array = fs.readFileSync('./llistatArtistes.txt').toString().split("\n");
	
	for(i in array) {
		artists.push(array[i]);
	}
	return artists;
}
async function getData(listArtists){
	let iterationArtist	=	0;
	console.log(listArtists.length);
	while(iterationArtist < listArtists.length){
		console.log('Artista actual:',listArtists[iterationArtist]);
		let usuari			=	await getUserInfo(listArtists[iterationArtist]);
		let obres			=	await getArtworksFromArtist(baseUrl+usuari.linkObres);
		let listArtWorks	=	await getMetaInfoArtWorks(obres);
		generateResummeArtist(usuari,listArtWorks);
		iterationArtist++;
	}
}
async function main(){
	try{
		const readline = require('readline-sync');
		let firstQuestion = readline.question("Llegir de l'arxiu 'llistatArtistes' (1) o link d'una categoria? (2)");
		if(+firstQuestion !== 1 && +firstQuestion !== 2){ return console.log("Has d'escriure 1 o 2")}
		let listArtists = [];
		if(firstQuestion == 1){
			listArtists		=	readFile();
		}else{
			let secondQuestion 			=	readline.question("Insereix el link de la categoria seguit d'un espai per indicar quants d'artistes vols agafar (max. 25)");
			let resultSecondQuestion	=	String(secondQuestion).split(' ');	
			if(Number.isNaN(resultSecondQuestion[1]) || resultSecondQuestion[1] > 25){ return console.log("No s'ha pogut llegir el número o és major a 25")};
			listArtists					=	await getArtistsFromCategory(resultSecondQuestion[0], resultSecondQuestion[1]);
			console.log('Escrapajerem aquests artistes:',listArtists);
		}
		await getData(listArtists);


	}catch(e){
		console.log('ERROR',e)
	}
	
}

main();

