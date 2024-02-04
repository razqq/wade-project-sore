import { int } from 'neo4j-driver'


export default class recommendationService {
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
   * This method should retrieve a list of artists as recommendations
   * the relationship between the User and his recoamndations will vary dependind on the connections
   * from Artist with :SIMILAR_TO, Users with the same :HAS_HOMETOWN / :HAS_LOCATION / :LIKES
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
   * @param {number} skip The number of rows to skip
   * @returns {Promise<Record<string, any>[]>}  An array of Artists objects
   */
  async all(userId, sort, order, limit, skip) {
    console.log("Get recommendations for:", { userId, limit, skip })

    // Open a new session
    const session = await this.driver.session({ database: 'good' })
  
    // Artist :SIMILAR_TO Artist will be at any grade in different procents (rest, if it's not enough add random)
    // Random Artists will be return in varios procents (rest or max 5%)
    // GRADE -1 - skip Artists that Users with similar relationships :DISLIKES
    // GRADE 1 - other Users :LIKES same Artist =>  return Users :LIKES other Artists (max 50%)
    // GRADE 2 - other User :HAS_HOMETOWN / :HAS_LOCATION as the current User => return Users :LIKES Artist (25%)
    // GRADE 3 - other User :HAS_HOMETOWN as current User location or :HAS_LOCATION as the current User hometown => return Users :LIKES Artist (15%)
    // GRADE 4 - nothing in common => :SIMILAR_TO (70%) and random (30%)
    
    // get a list of  similar artists (70% from limit)
    const limitSimilar = Math.floor(limit * 0.7);
    let listSimilar = await session.executeRead(
      tx => tx.run(
        `
        MATCH (u:User {userId: $userId})-[:LIKES]->(a:Artist)
        MATCH (a)<-[:LIKES]-(otherUsers:User)
        MATCH (a)-[:SIMILAR_TO]-(b:Artist)
        WHERE NOT (u)-[:LIKES|DISLIKES]->(b) AND NOT (otherUsers)-[:DISLIKES]->(b)
        WITH a, b
        ORDER BY a.name ASC
        SKIP $skip
        LIMIT $limit
        WITH b, collect(a.name) AS aArtistNames
        RETURN collect({id:b.artist_id, name: b.name, reason: "you liked "+ reduce(s = "", name IN aArtistNames | s + name + ", ")}) AS artists
        `,
        { userId, limit: int(limitSimilar), skip: int(skip)}
      )
    )
    console.log("listSimilar", listSimilar.records[0].get('artists'))

    // get a list of artists that other Users :LIKES same Artist =>  return Users :LIKES other Artists (max 50%)
    const limitLikes = Math.floor(limit * 0.5);
    let listFriendsLiked = await session.executeRead(
      tx => tx.run(
        `
        MATCH (u:User {userId: $userId})-[:LIKES]->(a:Artist)
        MATCH (a)<-[:LIKES]-(f:User)
        MATCH (f)-[:LIKES]->(b:Artist)
        WHERE NOT (u)-[:LIKES]->(b) AND NOT (a)-[:SIMILAR_TO]-(b) AND NOT (u)-[:DISLIKES]->(b)
        WITH b, collect(a.name) AS aArtistNames, f
        ORDER BY b.name ASC
        SKIP $skip
        LIMIT $limit
        RETURN collect({id:b.artist_id, name: b.name, reason: "both liked " + reduce(s = "", name IN aArtistNames | s + name + ", "), recommended_by: f.name}) AS artists
        `,
        { userId, limit: int(limitLikes), skip: int(skip)}
      )
    )

    //get a list of artists that other User :HAS_HOMETOWN / :HAS_LOCATION as the current User => return Users :LIKES Artist (25%)
    const limitSameLocation = Math.floor(limit * 0.13);
    let listSameLocation = await session.executeRead(
      tx => tx.run(
        `
        MATCH (u:User {userId: $userId})-[:LIKES]->(a:Artist)
        WITH u, collect(a) AS artistsLikedByU
        MATCH (u)-[:LOCATED_IN|HAS_HOMETOWN]->(l:Town)
        MATCH (l)<-[:LOCATED_IN|HAS_HOMETOWN]-(f:User)
        WHERE NONE(a IN artistsLikedByU WHERE (f)-[:LIKES]->(a))
        MATCH (f)-[:LIKES]->(b:Artist)
        WHERE NOT (u)-[:DISLIKES]->(b)
        WITH b, l, f
        ORDER BY b.name ASC
        SKIP $skip
        LIMIT $limit
        RETURN collect({id:b.artist_id, name: b.name, reason: "have similar locations " + l.name, recommended_by: f.name}) AS artists
        `,
        { userId, limit: int(limitSameLocation), skip: int(skip)}
      )
    )

    const limitSameJob = Math.floor(limit * 0.13);
    let listSameJob = await session.executeRead(
      tx => tx.run(
        ` MATCH (u:User {userId: $userId})-[:LIKES]->(a:Artist)
        WITH u, collect(a) AS artistsLikedByU
        MATCH (u)-[:WORKS_AS]->(j:Job)
        MATCH (j)<-[:WORKS_AS]-(f:User)
        WHERE NONE(a IN artistsLikedByU WHERE (f)-[:LIKES]->(a))
        MATCH (f)-[:LIKES]->(b:Artist)
        WHERE NOT (u)-[:DISLIKES]->(b)
        WITH b, j, f
        ORDER BY b.name ASC
        SKIP $skip
        LIMIT $limit
        RETURN collect({id:b.artist_id, name: b.name, reason: "have similar job" + j.name, recommended_by: f.name}) AS artists
        `,
        { userId, limit: int(limitSameJob), skip: int(skip)}
      )
    )

    // create a list starting with recommendations from listFriendsLiked (max: 50%), then listSameLocation (max: 25%) and then listSimilar (max: 70% if there are no others recommendastions from previous lists, min: 20%) and random (30% if there are no others recommendastions from previous lists, min: 5%)
    const MAX_TOTAL_RECOMMENDATIONS = limit; // Define the max number of recommendations

    listFriendsLiked = listFriendsLiked.records[0].get('artists');
    listSameLocation = [...listSameLocation.records[0].get('artists'), ...listSameJob.records[0].get('artists')]; 
    listSimilar = listSimilar.records[0].get('artists'); 

    console.log("listFriendsLiked length: ", listFriendsLiked.length)
    console.log("listSameLocation length: ", listSameLocation.length)

    // Calculate max items for each category
    let maxSimilar = Math.floor(MAX_TOTAL_RECOMMENDATIONS * 0.70); // Initialize with the max value
    let minRandom = Math.floor(MAX_TOTAL_RECOMMENDATIONS * 0.05); // Initialize with the min value

    // Initialize the final list
    const finalRecommendations = [...listFriendsLiked, ...listSameLocation];

    console.log("finalRecommendations before similar", finalRecommendations.length); // List of recommendations after adding listSimilar

    // Calculate remaining slots after adding listFriendsLiked and listSameLocation
    const remainingSlots = MAX_TOTAL_RECOMMENDATIONS - finalRecommendations.length;

    // Adjust maxSimilar and minRandom based on the remaining slots
    maxSimilar = Math.min(maxSimilar, remainingSlots - 1); // Adjust maxSimilar if necessary
    minRandom = Math.max(minRandom, remainingSlots - maxSimilar); // Adjust minRandom if necessary

    console.log("maxSimilar: ", maxSimilar)
    console.log("listSimilar length: ", listSimilar.length)

    // Add recommendations from listSimilar
    finalRecommendations.push(...listSimilar.slice(0, maxSimilar));
    const maxRandom = MAX_TOTAL_RECOMMENDATIONS - finalRecommendations.length;
    
    console.log("maxRandom",maxRandom); 

    // get a list of random artists that are not like or disliked by the current user, are not similar with the artists that the user likes or dislikes, are not liked or disliked by other users that likes the same artists as the current user,  are not liked or disliked by other users that have the same :LOCATED_IN or :HAS_HOMETOWN town as the current user
    const limitRandom = maxRandom;
    let listRandom = await session.executeRead(
      tx => tx.run(
        `
        MATCH (u:User {userId: $userId})-[:LIKES|DISLIKES]->(a:Artist)
        WITH u, collect(a) AS allLikedDisliked
        MATCH (u)-[:LOCATED_IN|HAS_HOMETOWN]->(l:Town)<-[:LOCATED_IN|HAS_HOMETOWN]-(otherUsers:User)
        WITH u, allLikedDisliked, collect(DISTINCT otherUsers) AS allOtherUsers
        MATCH (otherUser)-[:LIKES|DISLIKES]->(otherLikedDisliked:Artist)
        WHERE otherUser IN allOtherUsers
        WITH u, allLikedDisliked, collect(DISTINCT otherLikedDisliked) AS allLikedDislikedByOthers
        UNWIND allLikedDisliked AS likedDislikedArtist
        MATCH (likedDislikedArtist)-[:SIMILAR_TO]-(similar:Artist)
        WITH u, allLikedDisliked, allLikedDislikedByOthers, collect(DISTINCT similar) AS allSimilarArtists
        WITH u, allLikedDisliked + allSimilarArtists + allLikedDislikedByOthers AS allUnwantedArtists
        MATCH (b:Artist)
        WHERE NOT (u)-[:LIKES|DISLIKES]->(b) 
        AND NOT b IN allUnwantedArtists
        WITH DISTINCT b
        ORDER BY rand()
        SKIP $skip
        LIMIT $limit
        RETURN collect({id:b.artist_id, name: b.name, random: true}) AS artists
        `,
        { userId, skip: int(skip), limit: int(limitRandom) }
      )
    )
    listRandom = listRandom.records[0].get('artists'); 

    console.log("finalRecommendations before random", finalRecommendations.length); // List of recommendations after adding listSimilar
    finalRecommendations.push(...listRandom.slice(0, Math.min(listRandom.length, maxRandom)));

    // If there are still remaining slots, fill them with more items from listRandom
    if (finalRecommendations.length < MAX_TOTAL_RECOMMENDATIONS) {
        const additionalRandom = MAX_TOTAL_RECOMMENDATIONS - finalRecommendations.length;
        finalRecommendations.push(...listRandom.slice(minRandom, minRandom + additionalRandom));
    }

    console.log("finalRecommendations",finalRecommendations.length); // Final list of recommendations


    // Close session
    await session.close()
    return finalRecommendations;
  }

  /**
   * @public
   * This method should add a new artist to the user's favorites
   * 
   * @param {string} userId  The unique ID of the user
   * @param {string} artistId The unique ID of the artist
   * @returns {Promise<Record<string, any>>}  The newly created relationship
   * @throws {Error} If the artist does not exist
   * @throws {Error} If the relationship could not be created
   *
   */

  async like(userId, artistId) {
    // Open a new session
    const session = await this.driver.session({ database: 'good' })

    // Create a new relationship between the user and the artist
    const result = await session.executeWrite(
      tx => tx.run(
        `
        OPTIONAL MATCH (u:User {userId: $userId})
        OPTIONAL MATCH (a:Artist {artist_id: $artistId})
        WITH u, a
        WHERE u IS NOT NULL AND a IS NOT NULL AND NOT(u)-[:DISLIKES]->(a)
        MERGE (u)-[r:LIKES]->(a)
        ON CREATE SET r.created = timestamp()
        RETURN u, a, r
        `,
        { userId, artistId }
      )
    )

    // Close session
    await session.close()

    // Check if the relationship was created
    if (result.records.length === 0) {
      throw new Error('Could not create relationship - User or Artist not found or the user dislikes the artist')
    }

    // Return the newly created relationship
    return {status: 0}
  }

  /**
   * @public
   * This method should remove an artist from the user's favorites
   * 
   * @param {string} userId  The unique ID of the user
   * @param {string} artistId The unique ID of the artist
   * @returns {Promise<Record<string, any>>}  The deleted relationship
   * @throws {Error} If the relationship could not be deleted
   * @throws {Error} If the user or artist does not exist
   */

  async unlike(userId, artistId) {
    // Open a new session
    const session = await this.driver.session({ database: 'good' })

    // Delete the relationship between the user and the artist
    const result = await session.executeWrite(
      tx => tx.run(
        `
        OPTIONAL MATCH (u:User {userId: $userId})-[r:LIKES|DISLIKES]->(a:Artist {artist_id: $artistId})
        WITH u, a, r
        WHERE u IS NOT NULL AND a IS NOT NULL AND r IS NOT NULL
        DELETE r
        RETURN u, a, r
        `,
        { userId, artistId }
      )
    )

    // Close session
    await session.close()

    // Check if the relationship was deleted
    if (result.records.length === 0) {
      throw new Error('Could not delete relationship - User or Artist are not found')
    }

    // Return the deleted relationship
    return {status: 0}
  }

  /**
   * @public
   * This method should add a new artist to the user's dislikes
   * 
   * @param {string} userId  The unique ID of the user
   * @param {string} artistId The unique ID of the artist
   * @returns {Promise<Record<string, any>>}  The newly created relationship
   * @throws {Error} If the artist does not exist
   * @throws {Error} If the relationship could not be created
   */

  async dislike(userId, artistId) {
    // Open a new session
    const session = await this.driver.session({ database: 'good' })

    // Create a new relationship between the user and the artist
    const result = await session.executeWrite(
      tx => tx.run(
        `
        OPTIONAL MATCH (u:User {userId: $userId})
        OPTIONAL MATCH (a:Artist {artist_id: $artistId})
        WITH u, a
        WHERE u IS NOT NULL AND a IS NOT NULL AND NOT(u)-[:LIKES]->(a)
        MERGE (u)-[r:DISLIKES]->(a)
        ON CREATE SET r.created = timestamp()
        RETURN u, a, r
        `,
        { userId, artistId }
      )
    )

    // Close session
    await session.close()

    // Check if the relationship was created
    if (result.records.length === 0) {
      throw new Error('Could not create relationship - User or Artist not found or the user likes the artist')
    }

    // Return the newly created relationship
    return {status: 0}
  }
}