import jwt from 'jsonwebtoken'
import { hash, compare } from 'bcrypt'
import ValidationError from '../errors/validation.error.js'
import { JWT_SECRET, SALT_ROUNDS } from '../constants.js'

export default class AuthService {
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

  transformCreatedDate (music)  {
    music.forEach(item => {

      // Your date-time string
      let dateTimeString = item.created_time;

      // Replace the last four digits with 'Z' to make it ISO 8601 compliant
      dateTimeString = dateTimeString.replace(/\+0000$/, 'Z');

      // Create a Date object
      let dateObject = new Date(dateTimeString);

      // Get timestamp
      let timestamp = dateObject.getTime();

      // Output the timestamp
      item.created_time = timestamp;
    });
  }

  /**
   * @public
   * This method should create a new User node in the database with the email and name
   * provided, along with an encrypted version of the password and a `userId` property
   * generated by the server.
   *
   * The properties also be used to generate a JWT `token` which should be included
   * with the returned user.
   *
   * @param {string} email
   * @param {string} plainPassword
   * @param {string} name
   * @param {string} gender
   * @param {string} location
   * @param {string} hometown
   * @param {Array} music
   * @returns {Promise<Record<string, any>>}
   */
  async register(email, name, gender, location, hometown, music) {
    // const encrypted = await hash(plainPassword, parseInt(SALT_ROUNDS))

    // Open a new session
    const session = this.driver.session({ database: 'good' })

    //find location and hometown nodes
    const diverseLocations = location.split(',');
    const diverseHometowns = hometown.split(',');

    try {
      // Create the User node in a write transaction
      // CREATE CONSTRAINT FOR (u:User) REQUIRE u.email IS UNIQUE
      this.transformCreatedDate(music);
      console.log("PARAMS: ", email, name, gender, diverseLocations, diverseHometowns, music)
      const res = await session.executeWrite(
        tx => tx.run(
          `
            CREATE (u:User {
              userId: randomUuid(),
              email: $email,
              name: $name,
              gender: $gender})

            WITH u
            UNWIND $diverseLocations AS location
            MATCH (t:Town {name: location})
            MERGE (u)-[:LOCATED_IN]->(t)

            WITH u
            UNWIND $diverseHometowns AS hometown
            MATCH (h:Town {name: hometown})
            MERGE (u)-[:HAS_HOMETOWN]->(h)

            WITH u
            UNWIND $music AS artist
            MATCH (a:Artist {name: artist.name})
            MERGE (u)-[:LIKES {created: artist.created_time}]->(a)
            RETURN u
          `,
          { email, name, gender, diverseLocations, diverseHometowns, music }
        )
      )

      // Extract the user from the result
      const [first] = res.records
      const node = first.get('u')

      const { password, ...safeProperties } = node.properties

      return {
        ...safeProperties,
        token: jwt.sign(this.userToClaims(safeProperties), JWT_SECRET),
      }
    }
    catch (e) {
      // Handle unique constraints in the database
      if (e.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
        //try to log in
        return await this.authenticate(email);
        // throw new ValidationError(
        //   `An account already exists with the email address ${email}`,
        //   {
        //     email: 'Email address already taken'
        //   }
        // )
      }

      // Non-neo4j error
      throw e

    }
    finally {
      // Close the session
      await session.close()
    }

  }

  /**
   * @public
   * This method should attempt to find a user by the email address provided
   * and attempt to verify the password.
   *
   * If a user is not found or the passwords do not match, a `false` value should
   * be returned.  Otherwise, the users properties should be returned along with
   * an encoded JWT token with a set of 'claims'.
   *
   * {
   *   userId: 'some-random-uuid',
   *   email: 'graphacademy@neo4j.com',
   *   name: 'GraphAcademy User',
   *   token: '...'
   * }
   *
   * @param {string} email    The user's email address
   * @param {string} unencryptedPassword    An attempt at the user's password in unencrypted form
   * @returns {Promise<Record<string, any> | false>}    Resolves to a false value when the user is not found or password is incorrect.
   */
  async authenticate(email) {
    console.log("trying to authenticate", email)
    // Open a new session
    const session = this.driver.session({ database: 'good' })

    // Find the user node within a Read Transaction
    const res = await session.executeRead(
      tx => tx.run(
        'MATCH (u:User {email: $email}) RETURN u',
        { email }
      )
    )

    // Close the session
    await session.close()

    // Verify the user exists
    if (res.records.length === 0) {
      return false
    }

    // Compare Passwords
    const user = res.records[0].get('u')

    const { password, ...safeProperties } = user.properties

    return {
      ...safeProperties,
      token: jwt.sign(this.userToClaims(safeProperties), JWT_SECRET),
    }
  }


  /**
   * @private
   * This method should take a user's properties and convert the "safe" properties into
   * a set of claims that can be encoded into a JWT
   *
   * @param {Record<string, any>} user The User's properties from the database
   * @returns {Record<string, any>} Claims for the token
   */
  userToClaims(user) {
    const { name, userId } = user

    return { sub: userId, userId, name, }
  }

  /**
   * @public
   * This method should take the claims encoded into a JWT token and return
   * the information needed to authenticate this user against the database.
   *
   * @param {Record<string, any>} claims
   * @returns {Promise<Record<string, any>>}  The "safe" properties encoded above
   */
  async claimsToUser(claims) {
    return {
      ...claims,
      userId: claims.sub,
    }
  }
}
