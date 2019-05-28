let redis = require("redis")
let _ = require("lodash")

'use strict'

class Researchjs {
    /**
     * 
     * @param {Object} rediConnection {host, port}
     * @param {Boolean} withScores 
     */
    constructor(rediConnection, opts) {
        this.db = redis.createClient(rediConnection)
        this.withScores = true
        this.highlight  = opts.highlight!=undefined ? opts.highlight : false
    }

    /**
     * Search into Redisearch
     * @param {String} key 
     * @param {Array} query
     * @return {Promise} 
     */
    search( key, query ) {
        var total, data, err = null
        return new Promise( (resolve, reject) => {
            try {
                console.log("======= SEARCHING DOCUMENT=======")
                console.log(`QUERY : ${query}`)
                var q = [key]
                for (var i in query){
                    q.push(query[i])
                }
                
                if (this.withScores) q.push('WITHSCORES')
                if (this.highlight) q.push('HIGHLIGHT')
                
                console.time("EXECUTION TIME")
                this.db.send_command('FT.SEARCH',q, (err, reply) => {
                    
                    if (err){
                        return reject(err)
                    }
                    // Keep total record into new variable
                    total = reply[0]
                    
                    reply.shift() 
        
                    // We need chunk an array, so this will readable for user
                    let chuckSize = this.withScores ? 3 : 2
                    var dataDetail = _.chunk(reply, chuckSize)
                    data = this.parseData(dataDetail)
                    console.timeEnd("EXECUTION TIME")
                    return resolve({total, data, err})

                })
            }catch(err){
                resolve({total, data, err})
            }
            
        })
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