let _ = require("lodash")

'use strict'

class Researchjs {
    /**
     * 
     * @param {Object} rediConnection {host, port}
     * @param {Boolean} withScores 
     */
    constructor(redisClient, opts) {
        this.db = redisClient
        this.withScores = true
        this.highlight  = opts.highlight!=undefined ? opts.highlight : false
    }

    /**
     * Check Index is Available or Not 
     * @param {String} indexName 
     * @return {Promise}
     */
    indexIsAvailable( indexName ) {
        console.info("== CHECKING INDEX ==")
        return new Promise( (resolve, reject) => {
            this.db.send_command('FT.INFO',[indexName], (err, reply) => {
                if (err) {
                    return resolve(false)
                }
                return resolve(true)
            })
        })
    }

    /**
     * 
     * @param {String} indexName 
     * @param {Object} schemas 
     */
    createIndex( indexName, schemas ) {
        return new Promise( async (resolve, reject) => {
            try{
                var isAvailable = await this.indexIsAvailable(indexName)
                if (isAvailable){
                    return reject("Index is already exists")
                }

                var sch             = [indexName, 'SCHEMA']

                schemas.forEach( (schema) =>{
                    sch.push(schema.field)
                    schema.attributes.forEach( (attr) => {
                        sch.push(attr)
                    })
                    
                })
                
                this.db.send_command('FT.CREATE',sch, (err, reply) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(true)
                })
            }catch(err){
                return reject(err)
            }
            
        })
    }

    /**
     * Search into Redisearch
     * @param {String} key 
     * @param {Array} query
     * @return {Promise} 
     */
    search( key, query ) {
        var totalRS, dataRS, errRS = null
        return new Promise( (resolve, reject) => {
            try {
                console.log("======= SEARCHING DOCUMENT=======")
                console.log(`QUERY : ${query}`)
                var q = [key]
                for (var i in query){
                    q.push(query[i])
                }
                
                if (this.withScores) q.push('WITHSCORES')
                if (this.highlight) q.push('HIGHLIGHT','TAGS','<span style="background:yellow">','</span>')
                
                console.time("EXECUTION TIME")
                this.db.send_command('FT.SEARCH',q, (err, reply) => {
                    
                    if (err){
                        return reject(err)
                    }
                    // Keep total record into new variable
                    totalRS = reply[0]
                    
                    reply.shift() 
        
                    // We need chunk an array, so this will readable for user
                    let chuckSize = this.withScores ? 3 : 2
                    var dataDetail = _.chunk(reply, chuckSize)
                    dataRS = this.parseData(dataDetail)
                    console.timeEnd("EXECUTION TIME")
                    return resolve({totalRS, dataRS, errRS})

                })
            }catch(err){
                resolve({totalRS, dataRS, errRS})
            }
            
        })
    }

    add(newRecord){
        return new Promise( (resolve, reject) => {
            this.db.send_command('FT.ADD',newRecord, (err, reply) => {
                if (err) {
                    return reject(err)
                }else{
                    return resolve(newRecord)
                }
            })
        } )
    }

    /**
     * Parse Data from redisearch 
     * so it will readable
     * @param {Array} array 
     * @return {Array}
     */
    parseData(array) {
        return [].concat.apply([],
            array.map(function(elem,i) {
                var dt = elem[2]
                var newArray = new Array()
                var newRecord = {}
                newRecord["id"] = elem[0]
                newRecord["score"] = elem[1]
                for (i in dt){
                    if (i%2===0) {
                        var k = dt[i]
                        newRecord[ k ] = dt[ parseInt(i) + 1 ]
                        newArray = newRecord
                        
                    }
                }
                return [ newArray ]
                
            })
        );
    }
}

module.exports = Researchjs