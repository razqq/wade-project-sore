import { Router } from 'express'
import passport from 'passport'
import { getDriver } from '../neo4j.js'
import recommendationService from '../services/recommendation.service.js'
import ArtistsService from '../services/artists.service.js'
import { getPagination, getUserId } from '../utils.js'

const router = new Router()

/**
 * Require jwt authentication for these routes
 */
router.use(passport.authenticate('jwt', { session: false }))

/**
 * @GET /artists/
 *
 * This route simply returns the claims made in the JWT token
 */
router.get('/', (req, res, next) => {
  try {
    res.json(req.user)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @POST /artists/new
 * 
 * This route should add new artist to the database
 */
router.post('/new', async (req, res, next) => {
  try {
    const driver = getDriver()
    const { artistId, name } = req.body

    const service = new ArtistsService(driver)
    const artist = await service.add(artistId, name)

    res.json(artist)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @DELETE /artists/delete/:artistId
 * 
 * This route should delete an artist from the database
 */
router.delete('/delete/:artistId', async (req, res, next) => {
  try {
    const driver = getDriver()
    const { artistId } = req.params

    const service = new ArtistsService(driver)
    const artist = await service.delete(artistId)

    res.json(artist)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @POST /artists/similar
 * 
 * This route should a new :SIMILAR relationship between two artists
 */
router.post('/similar', async (req, res, next) => {
  try {
    const driver = getDriver()
    const { artistId, similarArtistId } = req.body

    const service = new ArtistsService(driver)
    const artist = await service.similar(artistId, similarArtistId)

    res.json(artist)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @POST /artists/dissimilar
 * 
 * This route should remove a :SIMILAR relationship between two artists
 */
router.post('/dissimilar', async (req, res, next) => {
  try {
    const driver = getDriver()
    const { artistId, similarArtistId } = req.body

    const service = new ArtistsService(driver)
    const artist = await service.dissimilar(artistId, similarArtistId)

    res.json(artist)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @GET /artists/recommendations/
 *
 * This route should return a list of artists that a user has added to their favorites
 */
router.get('/recommendations', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)

    //get limit and skip from query params
    const { sort, order } = getPagination(req)
    const limit = parseInt(req.query.limit || 10)
    const skip = parseInt(req.query.skip || 0)

    const service = new recommendationService(driver)
    const recommendations = await service.all(userId, sort, order, limit, skip)

    res.json(recommendations)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @POST /artists/recommendations/like
 * 
 * This route should add a new artist to the user's favorites
 */
router.post('/recommendations/like', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)
    const { artistId } = req.body

    const service = new recommendationService(driver)
    const recommendation = await service.like(userId, artistId)

    res.json(recommendation)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @POST /artists/recommendations/unlike
 * 
 * This route should remove an artist from the user's likes or dislikes
 */
router.post('/recommendations/unlike', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)
    const { artistId } = req.body

    const service = new recommendationService(driver)
    const recommendation = await service.unlike(userId, artistId)

    res.json(recommendation)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @POST /artists/recommendations/dislike
 * 
 * This route should add a new artist to the user's dislikes
 */

router.post('/recommendations/dislike', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)
    const { artistId } = req.body

    const service = new recommendationService(driver)
    const recommendation = await service.dislike(userId, artistId)

    res.json(recommendation)
  }
  catch (e) {
    next(e)
  }
})



export default router