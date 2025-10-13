/**
 * Script para subir avatares de ejemplo a Supabase Storage
 * Ejecutar con: node scripts/subir-avatares-ejemplo.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Avatares de ejemplo (nombres de archivos)
const avataresEjemplo = [
  'animal_cat_a1b2c3',
  'animal_dog_d4e5f6', 
  'animal_bird_g7h8i9',
  'animal_fish_j0k1l2',
  'animal_rabbit_m3n4o5',
  'animal_turtle_p6q7r8',
  'animal_butterfly_s9t0u1',
  'animal_dolphin_v2w3x4',
  'animal_elephant_y5z6a7',
  'animal_lion_b8c9d0',
  'animal_heart_ec4899'
]

async function crearAvatarSVG(nombre) {
  // Crear un SVG simple con el nombre del animal
  const animal = nombre.replace('animal_', '').split('_')[0]
  const color = nombre.split('_').pop()
  
  return `
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#${color}" stroke="#333" stroke-width="2"/>
      <text x="50" y="55" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="white">
        ${animal.charAt(0).toUpperCase()}
      </text>
    </svg>
  `
}

async function subirAvatares() {
  console.log('🚀 Iniciando subida de avatares de ejemplo...')
  
  try {
    // Verificar que el bucket existe
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    
    if (bucketError) {
      console.error('❌ Error listando buckets:', bucketError)
      return
    }
    
    const profilesBucket = buckets.find(b => b.name === 'profiles')
    if (!profilesBucket) {
      console.error('❌ Bucket "profiles" no encontrado')
      return
    }
    
    console.log('✅ Bucket "profiles" encontrado')
    
    // Subir cada avatar
    for (const nombreAvatar of avataresEjemplo) {
      try {
        const svgContent = await crearAvatarSVG(nombreAvatar)
        const blob = new Blob([svgContent], { type: 'image/svg+xml' })
        
        const filePath = `avatars/${nombreAvatar}.svg`
        
        console.log(`📤 Subiendo ${nombreAvatar}...`)
        
        const { data, error } = await supabase.storage
          .from('profiles')
          .upload(filePath, blob, {
            contentType: 'image/svg+xml',
            upsert: true
          })
        
        if (error) {
          console.error(`❌ Error subiendo ${nombreAvatar}:`, error.message)
        } else {
          console.log(`✅ ${nombreAvatar} subido exitosamente:`, data.path)
        }
        
      } catch (error) {
        console.error(`❌ Error procesando ${nombreAvatar}:`, error.message)
      }
    }
    
    console.log('🎉 Proceso completado!')
    
    // Listar archivos subidos
    const { data: files, error: listError } = await supabase.storage
      .from('profiles')
      .list('avatars')
    
    if (listError) {
      console.error('❌ Error listando archivos:', listError)
    } else {
      console.log('📋 Archivos en avatars/:', files?.map(f => f.name))
    }
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  subirAvatares()
}

module.exports = { subirAvatares }
