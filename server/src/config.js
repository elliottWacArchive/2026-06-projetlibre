/** @format */

module.exports = {
	port: process.env.PORT || 3000,
	clientUrl: process.env.CLIENT_URL || 'http://localhost:8080',
	databaseUrl:
		process.env.DATABASE_URL || 'postgres://ahme:ahme@localhost:5432/ahme',
	sessionTtlDays: 7,

	fileStoragePath: process.env.FILE_STORAGE_PATH || '/app/uploads',
	maxFileSize: 10 * 1024 * 1024,
	maxFilesPerDesk: 20,
};