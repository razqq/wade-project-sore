import { toNativeTypes } from '../utils.js'



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
     * @plublic
     * 
     * This method should return all the information about the user with the given `userId`.
     * 
     * @param {string} userId The unique ID of the user
     * @returns {Promise<Record<string, any>>} The user object
     * 
     */
    async info(userId) {
        // Open a new session
        const session = await this.driver.session({ database: 'good' })

        // Retrieve the user
        const res = await session.executeRead(
            tx => tx.run(
                `
                MATCH (u:User {userId: $userId})
                OPTIONAL MATCH (u)-[:WORKS_AS]->(j:Job)
                RETURN u {
                email: u.email,
                name: u.name,
                gender: u.gender,
                userId: u.userId,
                job: j.name
                } AS user
            `,
                { userId }
            )
        )

        // Close session
        await session.close()

        // Return the user
        console.log("info", res.records[0].get('user'));
        if(!res.records[0].get('user').job){
            res.records[0].get('user').job = "No job yet! 🧐"
        }
        return toNativeTypes(res.records[0].get('user'))
    }

    /**
     * @public
     * 
     * This method should link a user to a job
     * 
     * @param {string} userId The unique ID of the user
     * @param {string} jobName The name of the job
     */
    async addJob(userId, jobName) {
        // Open a new session
        const session = await this.driver.session({ database: 'good' })

        // Retrieve the user
        const res = await session.executeWrite(
            tx => tx.run(
                `
                MATCH (u:User {userId: $userId})
                MERGE (j:Job {name: $jobName})
                MERGE (u)-[:WORKS_AS]->(j)
                RETURN j as job
            `,
                { userId, jobName }
            )
        )

        // Close session
        await session.close()

        // Return the job
        return toNativeTypes(res.records[0].get('job'))
    }
}