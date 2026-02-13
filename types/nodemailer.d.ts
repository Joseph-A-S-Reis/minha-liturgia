declare module "nodemailer" {
	const nodemailer: {
		createTransport: (...args: any[]) => {
			sendMail: (...args: any[]) => Promise<any>;
		};
	};

	export default nodemailer;
}
