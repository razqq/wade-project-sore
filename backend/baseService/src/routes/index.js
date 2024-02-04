import { Router } from 'express'
import account from './account.routes.js'
import auth from './auth.routes.js'
import artists from './artists.routes.js'
import songs from './songs.routes.js'

const router = new Router()

router.use('/auth', auth)
router.use('/account', account)
router.use('/artists', artists)
router.use('/songs', songs)

export default router
