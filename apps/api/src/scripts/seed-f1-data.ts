/**
 * F1 Data Bootstrap/Seeding Script
 * 
 * This script imports all F1 data from Jolpica API for a given year:
 * - Season
 * - Races (with circuit information)
 * - Drivers
 * - Constructors (stored in race results)
 * - Race results (for completed races)
 * 
 * Usage:
 *   npm run seed:f1              # Seed current year
 *   npm run seed:f1 -- 2025      # Seed specific year
 *   npm run seed:f1 -- --all     # Seed all available historical data
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import { F1DataService } from '../modules/f1data/f1data.service';
import JolpicaClient from '../modules/f1data/jolpica-client';

const prisma = new PrismaClient();
const f1dataService = new F1DataService(prisma);
const jolpicaClient = new JolpicaClient(prisma);

interface SeedResult {
  seasonId: string;
  year: number;
  racesSynced: number;
  driversSynced: number;
  resultsSynced: number;
  errors: string[];
}

/**
 * Get current F1 season year
 */
function getCurrentSeasonYear(): number {
  const now = new Date();
  // F1 season typically runs March-December
  // If we're in Jan-Feb, we're still in the previous year's season
  if (now.getMonth() < 2) {
    return now.getFullYear() - 1;
  }
  return now.getFullYear();
}

/**
 * Seed F1 data for a specific season year
 */
async function seedSeason(year: number): Promise<SeedResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Seeding F1 data for ${year} season...`);
  console.log(`${'='.repeat(60)}\n`);

  const result: SeedResult = {
    seasonId: '',
    year,
    racesSynced: 0,
    driversSynced: 0,
    resultsSynced: 0,
    errors: [],
  };

  try {
    // 1. Sync season
    console.log('📋 Syncing season...');
    const seasonResult = await jolpicaClient.syncSeason(year);
    result.seasonId = seasonResult.seasonId;
    console.log(`   ✓ Season ${year} ${seasonResult.created ? 'created' : 'already exists'} (ID: ${seasonResult.seasonId})`);

    // 2. Sync races
    console.log('\n🏁 Syncing races...');
    const racesResult = await jolpicaClient.syncRaces(year);
    result.racesSynced = racesResult.synced;
    result.errors.push(...racesResult.errors);
    console.log(`   ✓ Synced ${racesResult.synced} races`);
    if (racesResult.errors.length > 0) {
      console.log(`   ⚠ ${racesResult.errors.length} errors occurred`);
    }

    // 3. Sync drivers
    console.log('\n👤 Syncing drivers...');
    const driversResult = await jolpicaClient.syncDrivers(year);
    result.driversSynced = driversResult.synced;
    result.errors.push(...driversResult.errors);
    console.log(`   ✓ Synced ${driversResult.synced} drivers`);
    if (driversResult.errors.length > 0) {
      console.log(`   ⚠ ${driversResult.errors.length} errors occurred`);
    }

    // 4. Sync race results for completed races
    console.log('\n📊 Syncing race results for completed races...');
    const season = await prisma.season.findUnique({
      where: { year },
      include: {
        races: {
          orderBy: { round: 'asc' },
        },
      },
    });

    if (season) {
      const now = new Date();
      const completedRaces = season.races.filter((race) => race.date < now);
      
      console.log(`   Found ${completedRaces.length} completed races`);
      
      for (const race of completedRaces) {
        console.log(`   - Processing ${race.raceName} (Round ${race.round})...`);
        const resultsResult = await jolpicaClient.syncRaceResults(year, race.round);
        
        if (resultsResult.synced > 0) {
          result.resultsSynced += resultsResult.synced;
          console.log(`     ✓ Synced ${resultsResult.synced} results`);
        } else if (resultsResult.errors.length === 0) {
          console.log(`     ℹ No results available yet (race may not have completed)`);
        }
        
        result.errors.push(...resultsResult.errors);
        
        if (resultsResult.discrepancies.length > 0) {
          console.log(`     ⚠ ${resultsResult.discrepancies.length} data discrepancies detected`);
        }
      }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`✅ Season ${year} seeding complete!`);
    console.log(`   - Races: ${result.racesSynced}`);
    console.log(`   - Drivers: ${result.driversSynced}`);
    console.log(`   - Results: ${result.resultsSynced}`);
    if (result.errors.length > 0) {
      console.log(`   - Errors: ${result.errors.length}`);
    }
    console.log(`${'─'.repeat(60)}\n`);

  } catch (error) {
    result.errors.push(`Season ${year} seeding failed: ${error}`);
    console.error(`\n❌ Failed to seed season ${year}:`, error);
  }

  return result;
}

/**
 * Seed all available historical seasons
 */
async function seedAllSeasons(): Promise<void> {
  console.log('\n🌍 Seeding all available historical F1 data...\n');

  // Get all available seasons from Jolpica
  const seasons = await jolpicaClient.getSeasons();
  console.log(`Found ${seasons.length} seasons available from Jolpica`);

  const currentYear = getCurrentSeasonYear();
  const results: SeedResult[] = [];

  // Seed each season (limit to recent years to avoid overwhelming the API)
  const recentSeasons = seasons
    .map((s) => parseInt(s.season, 10))
    .filter((year) => year >= 2018 && year <= currentYear) // Last ~8 years
    .sort((a, b) => a - b);

  console.log(`Will seed ${recentSeasons.length} seasons: ${recentSeasons.join(', ')}\n`);

  for (const year of recentSeasons) {
    const result = await seedSeason(year);
    results.push(result);
    
    // Add a small delay between seasons to be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEEDING SUMMARY');
  console.log('='.repeat(60));
  
  const totalRaces = results.reduce((sum, r) => sum + r.racesSynced, 0);
  const totalDrivers = results.reduce((sum, r) => sum + r.driversSynced, 0);
  const totalResults = results.reduce((sum, r) => sum + r.resultsSynced, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`Total seasons seeded: ${results.length}`);
  console.log(`Total races: ${totalRaces}`);
  console.log(`Total drivers: ${totalDrivers}`);
  console.log(`Total results: ${totalResults}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Display current database state
 */
async function showDatabaseStats(): Promise<void> {
  console.log('\n📊 Current Database Statistics:\n');
  
  const seasonsCount = await prisma.season.count();
  const racesCount = await prisma.race.count();
  const driversCount = await prisma.driver.count();
  const resultsCount = await prisma.raceResult.count();

  console.log(`   Seasons: ${seasonsCount}`);
  console.log(`   Races: ${racesCount}`);
  console.log(`   Drivers: ${driversCount}`);
  console.log(`   Race Results: ${resultsCount}`);
  console.log('');

  // Show seasons with race/driver counts
  const seasons = await prisma.season.findMany({
    orderBy: { year: 'desc' },
    include: {
      _count: {
        select: { races: true, drivers: true },
      },
    },
  });

  if (seasons.length > 0) {
    console.log('   Seasons in database:');
    for (const season of seasons) {
      console.log(`     ${season.year}: ${season._count.races} races, ${season._count.drivers} drivers`);
    }
  }
  console.log('');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('\n🏎️  PitLane F1 Data Bootstrap Script');
  console.log('='.repeat(60));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const seedAll = args.includes('--all');
  const showStats = args.includes('--stats');
  const specificYear = args.find((arg) => !arg.startsWith('--') && !isNaN(parseInt(arg, 10)));

  try {
    // Show stats only
    if (showStats) {
      await showDatabaseStats();
      return;
    }

    // Show current state before seeding
    await showDatabaseStats();

    if (seedAll) {
      // Seed all historical seasons
      await seedAllSeasons();
    } else if (specificYear) {
      // Seed specific year
      const year = parseInt(specificYear, 10);
      await seedSeason(year);
    } else {
      // Default: seed current season
      const currentYear = getCurrentSeasonYear();
      console.log(`No year specified, seeding current season: ${currentYear}`);
      await seedSeason(currentYear);
    }

    // Show final stats
    await showDatabaseStats();

    console.log('✅ F1 data bootstrap complete!\n');

  } catch (error) {
    console.error('\n❌ Bootstrap failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();