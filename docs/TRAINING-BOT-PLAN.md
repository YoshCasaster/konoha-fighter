# Rencana Bot Sawit Aktif

## Tujuan

Bot Sawit dapat menjadi lawan latihan yang bergerak, bertahan, melakukan combo, dan memakai skill. Semua keputusan bot menghasilkan `Input` yang sama dengan input pemain agar simulasi tetap deterministik dan siap dipindahkan ke server authoritative saat mode online dibuat.

Mode training tetap menyediakan opsi **Dummy Diam**. Pemain dapat mengganti perilaku bot tanpa keluar dari arena.

## Pilihan latihan

| Pengaturan | Pilihan |
|---|---|
| Perilaku | Diam, Bertahan, Combo, CPU Aktif |
| Kesulitan | Pemula, Normal, Sulit |
| HP bot | Tidak terbatas atau normal 160 HP |
| Energi | Penuh tanpa cooldown atau mengikuti aturan versus |
| Guard | Tidak pernah, acak, setelah membaca ancaman |
| Posisi reset | Tengah, sudut kiri, sudut kanan |

## Arsitektur

Tambahkan modul `packages/game-core/src/training-bot.ts` dengan fungsi murni:

```ts
decideTrainingBot(world, slot, memory, difficulty): {
  input: Input;
  memory: BotMemory;
}
```

`BotMemory` menyimpan rencana combo, target jarak, waktu reaksi, cooldown keputusan, dan kesalahan yang sengaja dibuat. Modul tidak membaca DOM, waktu perangkat, atau angka acak global. Jika variasi dibutuhkan, gunakan generator angka acak dengan seed dari world agar replay selalu menghasilkan pertandingan yang sama.

## State perilaku

1. **Observe** — membaca jarak, posisi, energi, state lawan, dan posisi sudut.
2. **Approach** — mendekat sampai jarak serangan yang dipilih.
3. **Pressure** — memakai serangan ringan, berat, atau combo yang valid.
4. **Defend** — menahan DEF terhadap serangan yang sudah melewati waktu reaksi.
5. **Punish** — membalas recovery serangan lawan.
6. **Skill Setup** — mencari jarak dan kondisi yang cocok untuk skill.
7. **Recover** — keluar dari sudut atau menjaga jarak setelah serangan gagal.

## Combo awal

Bot memilih combo berdasarkan karakter yang sedang dipakai:

### Mamang Grrovy

- Punch → Punch → Kick.
- DEF → Punch sebagai punish ringan.
- Tembakan Shuuu saat lawan berada di luar jangkauan pukulan.
- Serbuan Celeng setelah lawan jatuh dan mulai bangun.
- Titah Malaikat hanya saat energi penuh dan lawan tidak sedang KO.

### King Etanol

- Punch → Kick untuk tekanan jarak dekat.
- DEF → Kick sebagai punish berat.
- Ethanol Flame pada jarak menengah.
- Black Oil ketika lawan menyentuh lantai dan tidak sedang melompat.
- Robot Tong saat lawan berada di garis laser dan King tidak sedang ditekan.

Bot tidak membatalkan recovery, tidak membaca input pada frame yang sama, dan tidak memperoleh energi tambahan. Semua combo harus melewati aturan startup, active, recovery, energi, dan cooldown yang sama dengan pemain.

## Tingkat kesulitan

| Parameter | Pemula | Normal | Sulit |
|---|---:|---:|---:|
| Waktu reaksi | 20–28 frame | 12–18 frame | 7–11 frame |
| Peluang menyelesaikan combo | 35% | 65% | 85% |
| Peluang guard | 25% | 50% | 72% |
| Kesalahan jarak | Tinggi | Sedang | Rendah |
| Penggunaan ultimate | Jarang | Situasional | Optimal tetapi tidak sempurna |

Kesulitan Sulit tetap memiliki jeda reaksi dan peluang salah. Bot tidak boleh membaca input masa depan atau melakukan perfect block terus menerus.

## UI training

Tambahkan panel ringkas pada tombol **Training Settings**:

- Perilaku Bot.
- Kesulitan.
- HP dan energi.
- Tampilkan input bot.
- Reset posisi.
- Rekam dan putar ulang input pemain.

Indikator kecil di atas Bot Sawit menampilkan state seperti `APPROACH`, `DEFEND`, `COMBO`, atau `SKILL` agar pengguna memahami respons bot.

## Tahapan pengerjaan

### Tahap 1 — Bot dasar

- Gerak, lompat, jongkok, DEF, Punch, dan Kick.
- Tiga tingkat waktu reaksi.
- Reset posisi serta pilihan dummy diam.
- Pengujian determinisme dan larangan input ilegal.

### Tahap 2 — Combo dan skill

- Daftar combo per karakter.
- Evaluasi jarak dan energi.
- Pemakaian ketiga skill dengan kondisi aman.
- Recovery ketika serangan meleset.

### Tahap 3 — Training tools

- Panel pengaturan di dalam arena.
- Input history dan damage counter.
- Rekam serta playback pola pemain.
- Pilihan guard setelah hit pertama dan wake-up behavior.

### Tahap 4 — Persiapan online

- Jalankan bot melalui tick simulasi server.
- Seed keputusan disimpan bersama replay.
- Batas maksimal keputusan per detik.
- Tes soak beberapa ribu ronde untuk mencari loop, posisi macet, dan combo tanpa akhir.

## Kriteria selesai

- Bot tidak pernah menghasilkan input yang mustahil dilakukan pemain.
- Pertandingan dengan seed dan input yang sama menghasilkan state akhir yang sama.
- Bot mampu menyelesaikan combo karakter pada jarak valid.
- DEF dan penggunaan skill mengikuti waktu reaksi sesuai tingkat kesulitan.
- Bot dapat dikalahkan pada mode HP normal.
- Mode Dummy Diam yang sekarang tetap tersedia.
