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
     * This method should add a new artist to database
     * 
     * @param {string} artistId The unique ID of the artist
     * @returns {Promise<Record<string, any>>} The artist object
     * 
     */
    async add(artistId, name) {
        // Open a new session
        const session = await this.driver.session({ database: 'good' })
        console.log("Adding artist: ", artistId, name)

        const res = await session.executeWrite(
            tx => tx.run(
                `
            // Check for an existing artist with the same name but different artist_id
            OPTIONAL MATCH (conflictName:Artist {name: $name})
            WITH conflictName
            WHERE conflictName IS NULL OR conflictName.artist_id = $artistId
            // Proceed only if there's no conflict or the artist_id matches (meaning it's the same artist)
            MERGE (a:Artist { artist_id: $artistId })
            ON CREATE SET a.name = $name, a.created = timestamp()
            RETURN a as artist, CASE WHEN conflictName IS NOT NULL AND conflictName.artist_id <> $artistId THEN true ELSE false END as nameConflict
                `, { artistId, name }
            )
        )

        // Close session
        await session.close()

        if (res.records.length > 0) {
            // Return the artist
            return res.records[0].get('artist').properties
        } else {
            throw new Error('Artist name already exists')
        }

    }

    /**
     * @public
     * 
     * This method should delete an artist from database
     * 
     * @param {string} artistId The unique ID of the artist
     * @returns {Promise<Record<string, any>>} The artist object
     */
    async delete(artistId) {
        // Open a new session
        const session = await this.driver.session({ database: 'good' })

        // Delete the artist
        const result = await session.executeWrite(
            tx => tx.run(
                `
                MATCH (a:Artist {artist_id: $artistId})
                DETACH DELETE a
                RETURN a
                `,
                { artistId }
            )
        )

        // Close session
        await session.close()

        // Check if the artist was deleted
        if (result.records.length === 0) {
            throw new Error('Artist not found')
        }

        // Return the deleted artist
        return { status: 0 }
    }

    /**
     * @public
     * 
     * This method should add a new :SIMILAR relationship between two artists
     * 
     * @param {string} artistId The unique ID of the artist
     * @param {string} similarArtistId The unique ID of the similar artist
     * @returns {Promise<Record<string, any>>} The artist object
     */
    async similar(artistId, similarArtistId) {
        if (artistId === similarArtistId) {
            throw new Error('Cannot create relationship between the same artist')
        }

        // Open a new session
        const session = await this.driver.session({ database: 'good' })

        // Create a new relationship between the user and the artist
        const result = await session.executeWrite(
            tx => tx.run(
                `
                OPTIONAL MATCH (a:Artist {artist_id: $artistId})
                OPTIONAL MATCH (b:Artist {artist_id: $similarArtistId})
                WITH a, b
                WHERE a IS NOT NULL AND b IS NOT NULL AND NOT(a)-[:SIMILAR_TO]-(b)
                MERGE (a)-[r:SIMILAR_TO]->(b)
                ON CREATE SET r.created = timestamp()
                RETURN a, b ,r
                `,
                { similarArtistId, artistId }
            )
        )

        // Close session
        await session.close()

        // Check if the relationship was created
        if (result.records.length === 0) {
            throw new Error('Could not create relationship - Artist or similar Artist not found or the relationship already exists')
        }

        // Return the newly created relationship
        return { status: 0 }
    }

    /**
     * @public
     * 
     * This method should remove a :SIMILAR relationship between two artists
     * 
     * @param {string} artistId The unique ID of the artist
     * @param {string} similarArtistId The unique ID of the similar artist
     * @returns {Promise<Record<string, any>>} The artist object
     */
    async dissimilar(artistId, similarArtistId) {
        // Open a new session
        const session = await this.driver.session({ database: 'good' })

        // Create a new relationship between the user and the artist
        const result = await session.executeWrite(
            tx => tx.run(
                `
                OPTIONAL MATCH (a:Artist {artist_id: $artistId})
                OPTIONAL MATCH (b:Artist {artist_id: $similarArtistId})
                WITH a, b
                WHERE a IS NOT NULL AND b IS NOT NULL
                MATCH (a)-[r:SIMILAR_TO]-(b)
                DELETE r
                RETURN a, b
                `,
                { similarArtistId, artistId }
            )
        )

        // Close session
        await session.close()

        // Check if the relationship was created
        if (result.records.length === 0) {
            throw new Error('Could not delete relationship - Artist or similar Artist not found or the relationship does not exist')
        }

        // Return the newly created relationship
        return { status: 0 }
    }
}