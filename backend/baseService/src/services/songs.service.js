import { toNativeTypes } from '../utils.js'

import { int } from 'neo4j-driver'


export default class FavoriteService {
    /**
     * @type {neo4j.Driver}
     */
    driver

    /**
    * The constructor expects an instance of the Neo4j Driver, which will be
    * used to interact with Neo4j.
    *
    * @param {neo4j.Driver} driver
    */
    constructor(driver) {
        this.driver = driver
    }

    /**
     * @public
     * 
     * This method should add a new song to database
     * 
     * @param {string} artistId The unique ID of the artist
     * @param {string} name The name of the song
     * @returns {Promise<Record<string, any>>} The song object
     * 
     */
    async add(artistId, name) {
        // Open a new session
        const session = await this.driver.session({ database: 'good' })
        console.log("Adding song: ", artistId, name)

        // add new song in the database and link it to the artist with :OWNS relationship and set the created timestamp
        const res = await session.executeWrite(
            tx => tx.run(
                `
                    //check if the artist exists
                    MATCH (a:Artist {artist_id: $artistId})
                    //check if the artist already has a song with the same name
                    OPTIONAL MATCH (a)-[:OWNS]->(conflictSong:Song {name: $name})
                    WITH a, conflictSong
                    WHERE conflictSong IS NULL
                    MERGE (s:Song {name: $name})
                    ON CREATE SET s.created = timestamp()
                    MERGE (a)-[:OWNS]->(s)
                    RETURN s as song, CASE WHEN conflictSong IS NOT NULL THEN true ELSE false END as nameConflict
                    `, { artistId, name }
            )
        )

        // Close session
        await session.close()

        //check if there was a conflict
        if (res.records.length > 0) {
            // Return the song
            return res.records[0].get('song').properties
        } else {
            throw new Error('Song was not added to the database')
        }
    }

    /**
     * @public
     * 
     * This method should return the most recent songs added to the database
     * 
     * @param {number} limit The number of songs to return
     * @param {number} skip The number of rows to skip
     * @returns {Promise<Record<string, any>>} The list of recent songs
     */
    async recent(limit, skip) {
        // Open a new session
        const session = await this.driver.session({ database: 'good' })

        const res = await session.executeRead(
            tx => tx.run(
                `
                MATCH (s:Song)
                WHERE s.created IS NOT NULL
                OPTIONAL MATCH (s)<-[:OWNS]-(a:Artist)
                WITH s, a
                ORDER BY s.created DESC
                SKIP $skip
                LIMIT $limit
                RETURN s {
                    .name,
                    .created,
                    artist: a {.name, .artist_id} // Include desired artist properties
                } AS song
            `,
                { limit: int(limit), skip: int(skip) }
            )
        )

        // Close session
        await session.close()

        // Return the songs
        return res.records.map(record => toNativeTypes(record.get('song')))
    }

    /**
     * @public
     * 
     * This route should return the most recent songs added to the database from the artits that the user liked
     * 
     * @param {string} userId The unique ID of the user
     * @param {number} limit The number of songs to return
     * @param {number} skip The number of rows to skip
     * @returns {Promise<Record<string, any>>} List of recent songs from the artists that the user liked
     */
    async recentUserLiked(userId, limit, skip) {
        console.log("Get recent songs from artists that the user liked", { userId, limit, skip })
        // Open a new session
        const session = await this.driver.session({ database: 'good' })

        const res = await session.executeRead(
            tx => tx.run(
                `
                MATCH (u:User {userId: $userId})-[:LIKES]->(a:Artist)-[:OWNS]->(s:Song)
                WHERE s.created IS NOT NULL
                OPTIONAL MATCH (s)<-[:OWNS]-(a:Artist)
                WITH s, a
                ORDER BY s.created DESC
                SKIP 0
                LIMIT 10
                RETURN s {
                .name,
                .created,
                artist: a {.name, .artist_id}
                } AS song
            `,
                { userId, limit: int(limit), skip: int(skip) }
            )
        )

        // Close session
        await session.close()

        // Return the songs
        return res.records.map(record => toNativeTypes(record.get('song')))
    }
}