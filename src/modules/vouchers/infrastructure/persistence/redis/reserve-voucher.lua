-- Counts the active holds of a voucher and takes one, in a single atomic step.
-- KEYS[1]   sorted set of the voucher code
-- ARGV[1]   user id
-- ARGV[2]   now, in epoch milliseconds
-- ARGV[3]   expireAt of a new hold, in epoch milliseconds
-- ARGV[4]   how many holds may be active at the same time
-- returns   { 1, expireAt } when the user holds it, { 0, activeHolds } otherwise
local key = KEYS[1]
local userId = ARGV[1]
local now = tonumber(ARGV[2])
local expireAt = tonumber(ARGV[3])
local maxActiveHolds = tonumber(ARGV[4])

redis.call('ZREMRANGEBYSCORE', key, 0, now)

-- Whatever survived the cleanup is active, so an existing score means the user
-- already holds it: keep the original expireDate.
local existing = redis.call('ZSCORE', key, userId)
if existing then
  return { 1, existing }
end

local active = tonumber(redis.call('ZCARD', key))
if maxActiveHolds <= 0 or active >= maxActiveHolds then
  return { 0, tostring(active) }
end

redis.call('ZADD', key, expireAt, userId)
redis.call('PEXPIREAT', key, expireAt)
return { 1, tostring(expireAt) }
