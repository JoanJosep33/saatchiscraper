
module.exports ={
    getOccurrences : (array,entity)=>{
        const keyWords				=	array.map(el => el[entity]).flat();
        let keyWordsAppareances		=	[];	
        keyWords.forEach(keyword =>{
            if(keyWordsAppareances.find(el => el.value == keyword)){return}
            keyWordsAppareances.push({value : keyword, count : keyWords.filter(el => el == keyword).length})			
        });
        keyWordsAppareances = keyWordsAppareances.sort((a,b) => a.count > b.count ? -1 : 1);
        console.log(entity, array);
        return keyWordsAppareances;
    }
}