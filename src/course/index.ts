import data from 'virtual:course'
import type { Course, Topic } from './types'

const course = data as Course
export default course

export function getTopic(n: number): Topic | undefined {
  return course.topics.find((t) => t.n === n)
}
