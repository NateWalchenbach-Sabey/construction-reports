/**
 * Script to clean existing project names in the database
 * Removes date patterns from project names
 * 
 * Run with: npx tsx scripts/clean-project-names.ts
 */

import { PrismaClient } from '@prisma/client'
import { cleanProjectName } from '../lib/clean-project-name'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Cleaning project names to remove dates...\n')

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { code: 'asc' },
  })

  console.log(`Found ${projects.length} projects\n`)

  let updated = 0
  let unchanged = 0

  for (const project of projects) {
    const cleanedName = cleanProjectName(project.name)
    
    if (cleanedName !== project.name) {
      await prisma.project.update({
        where: { id: project.id },
        data: { name: cleanedName },
      })
      console.log(`✅ ${project.code}:`)
      console.log(`   Old: "${project.name}"`)
      console.log(`   New: "${cleanedName}"`)
      updated++
    } else {
      console.log(`⏭️  ${project.code}: "${project.name}" (no change needed)`)
      unchanged++
    }
  }

  console.log(`\n✅ Cleanup complete!`)
  console.log(`   Updated: ${updated} projects`)
  console.log(`   Unchanged: ${unchanged} projects`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
