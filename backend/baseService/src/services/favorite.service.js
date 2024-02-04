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
   * This method should retrieve a list of artists that have an incoming :LIKES
   * relationship from a User node with the supplied `userId`.
   *
   * Results should be ordered by the `sort` parameter, and in the direction specified
   * in the `order` parameter.
   * Results should be limited to the number passed as `limit`.
   * The `skip` variable should be used to skip a certain number of rows.
   *
   * @param {string} userId  The unique ID of the user
   * @param {string} sort The property to order the results by
   * @param {string} order The direction in which to order
   * @param {number} limit The total number of rows to return
   * @param {number} skip The nuber of rows to skip
   * @returns {Promise<Record<string, any>[]>}  An array of Artists objects
   */
  async likes(userId, sort, order, limit, skip) {
    // Open a new session
    const session = await this.driver.session({ database: 'good' })

    // Retrieve a list of artists favorited by the user
    const res = await session.executeRead(
      tx => tx.run(
        `
          MATCH (u:User {userId: $userId})-[:LIKES]->(a:Artist)
          RETURN a {
            .*,
            favorite: true
          } AS artist
          ORDER BY a.\`${sort}\` ${order}
          SKIP $skip
          LIMIT $limit
        `,
        { userId, skip: int(skip), limit: int(limit) }
      )
    )

    // Close session
    await session.close()

    return res.records.map(row => toNativeTypes(row.get('artist')))
  }

  /**
   * @public
   * This method should retrieve a list of artists that have an incoming :DISLIKES
   * relationship from a User node with the supplied `userId`.
   * 
   * Results should be ordered by the `sort` parameter, and in the direction specified
   * in the `order` parameter.
   * Results should be limited to the number passed as `limit`.
   * 
   * @param {string} userId  The unique ID of the user
   * @param {string} sort The property to order the results by
   * @param {string} order The direction in which to order
   * @param {number} limit The total number of rows to return
   * 
   */

  async dislikes(userId, sort, order, limit, skip) {
    // Open a new session
    const session = await this.driver.session({ database: 'good' })

    // Retrieve a list of artists favorited by the user
    const res = await session.executeRead(
      tx => tx.run(
        `
        MATCH (u:User {userId: $userId})-[:DISLIKES]->(a:Artist)
        RETURN a {
          .*,
          dislike: true
        } AS artist
        ORDER BY a.\`${sort}\` ${order}
        SKIP $skip
        LIMIT $limit
        `,
        { userId, skip: int(skip), limit: int(limit) }
      )
    )

    // Close session
    await session.close()

    return res.records.map(row => toNativeTypes(row.get('artist')))
  }

  /**
   * @public
   * 
   * This method should retrieve a list of artists that user interacted with (liked or disliked)
   * 
   * Results should be ordered by the timestamp of each relationship
   * 
   * @param {string} userId  The unique ID of the user
   * @param {number} limit The total number of rows to return
   * 
   */

  async history(userId, limit, skip) {
    // Open a new session
    const session = await this.driver.session({ database: 'good' })

    console.log("Get history for:", { userId, limit, skip })
  
    // Retrieve a list of artists favorited by the user
    const res = await session.executeRead(
      tx => tx.run(
          `
        MATCH (u:User {userId: $userId})-[r:LIKES|DISLIKES]->(a:Artist)

        RETURN a {
          .*,
          timestamp: r.created,
          relationship: type(r)
        } AS artist
        ORDER BY r.created DESC
        SKIP $skip
        LIMIT $limit
        `,
        { userId, skip: int(skip), limit: int(limit)}
      )
    )
  
    // Close session
    await session.close()
  
    // Convert the result records to native types
    return res.records.map(row => toNativeTypes(row.get('artist')))
  }
  
}