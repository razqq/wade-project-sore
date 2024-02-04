import { Router } from 'express'
import passport from 'passport'
import { getDriver } from '../neo4j.js'
import SongService from '../services/songs.service.js'
import { getPagination, getUserId} from '../utils.js'

const router = new Router()

/**
 * Require jwt authentication for these routes
 */
router.use(passport.authenticate('jwt', { session: false }))

/**
 * @GET /songs/
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
 * @POST /songs/new
 * 
 * This route should add new song to the database
 */
router.post('/new', async (req, res, next) => {
    try {
      const driver = getDriver()
      const { artistId, name } = req.body
  
      const service = new SongService(driver)
      const song = await service.add(artistId, name)
  
      res.json(song)
    }
    catch (e) {
      next(e)
    }
  })

  /**
   * @GET /songs/recent/
   * 
   * This route should return the most recent songs added to the database
   */
  router.get('/recent', async (req, res, next) => {
    try {
      const driver = getDriver()
      const {limit, skip } = req.query;
  
      const service = new SongService(driver)
      const songs = await service.recent(limit, skip)
  
      res.json(songs)
    }
    catch (e) {
      next(e)
    }
  })

  /**
   * @GET /songs/recent/userliked/
   * 
   * This route should return the most recent songs added to the database from the artits that the user liked
   */
  router.get('/recent/userliked', async (req, res, next) => {
    try {
      const driver = getDriver()
      const userId = getUserId(req)
      const {limit, skip } = getPagination(req)
  
      const service = new SongService(driver)
      const songs = await service.recentUserLiked(userId, limit, skip)
  
      res.json(songs)
    }
    catch (e) {
      next(e)
    }
  })

export default router